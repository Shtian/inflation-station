import { PaymentType } from "@prisma/client";
import {
  type CsvValidationError,
  type ParsedCsvRow,
  parseNorwegianBankCsv,
} from "./csv-parser";
import {
  buildTransactionFingerprint,
  dedupeParsedTransactions,
} from "./transaction-dedupe";

export type ImportSummary = {
  imported: number;
  duplicates: number;
  ignoredReserved: number;
  invalid: number;
};

export type ImportTransactionsResult = {
  summary: ImportSummary;
  errors: CsvValidationError[];
};

type ExistingTransactionFingerprintSource = {
  bookingDate: Date;
  amountNok: { toString(): string } | number;
  normalizedMerchant: string;
  paymentType: PaymentType;
};

type PreparedImportRow = Omit<ParsedCsvRow, "paymentType"> & {
  paymentType: PaymentType;
};

type ImportTransactionsDbClient = {
  account: {
    findUnique(args: {
      where: { id: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  transaction: {
    findMany(args: {
      where: { accountId: string };
      select: {
        bookingDate: true;
        amountNok: true;
        normalizedMerchant: true;
        paymentType: true;
      };
    }): Promise<ExistingTransactionFingerprintSource[]>;
    createMany(args: {
      data: Array<{
        accountId: string;
        bookingDate: Date;
        amountNok: number;
        currency: "NOK";
        normalizedMerchant: string;
        paymentType: PaymentType;
      }>;
    }): Promise<{ count: number }>;
  };
};

export class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Account ${accountId} not found`);
    this.name = "AccountNotFoundError";
  }
}

function normalizePaymentType(value: string): PaymentType {
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();

  if (["kort", "card"].includes(normalized)) {
    return PaymentType.CARD;
  }

  if (["overforing", "overfoering", "transfer"].includes(normalized)) {
    return PaymentType.TRANSFER;
  }

  if (["eft", "giro", "avtalegiro"].includes(normalized)) {
    return PaymentType.EFT;
  }

  if (["cash", "kontant"].includes(normalized)) {
    return PaymentType.CASH;
  }

  return PaymentType.OTHER;
}

function parseBookingDate(value: string): Date | null {
  const trimmed = value.trim();

  const norwegianDate = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (norwegianDate) {
    const [, day, month, year] = norwegianDate;
    const isoDate = `${year}-${month}-${day}`;
    const parsed = new Date(`${isoDate}T00:00:00.000Z`);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDate) {
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function mergeSummary(
  baseSummary: ImportSummary,
  imported: number,
  duplicateDelta: number,
  invalidDelta: number,
): ImportSummary {
  return {
    imported,
    duplicates: baseSummary.duplicates + duplicateDelta,
    ignoredReserved: baseSummary.ignoredReserved,
    invalid: baseSummary.invalid + invalidDelta,
  };
}

function buildExistingFingerprints(
  accountId: string,
  transactions: ExistingTransactionFingerprintSource[],
): Set<string> {
  return new Set(
    transactions.map((transaction) => {
      const amountNok = Number.parseFloat(transaction.amountNok.toString());
      const bookingDate = transaction.bookingDate.toISOString().slice(0, 10);

      return buildTransactionFingerprint({
        accountId,
        bookingDate,
        amountNok,
        normalizedMerchant: transaction.normalizedMerchant,
        paymentType: transaction.paymentType,
      });
    }),
  );
}

function splitValidAndInvalidRows(rows: ParsedCsvRow[]): {
  validRows: PreparedImportRow[];
  invalidRows: CsvValidationError[];
} {
  const validRows: PreparedImportRow[] = [];
  const invalidRows: CsvValidationError[] = [];

  for (const [index, row] of rows.entries()) {
    const bookingDate = parseBookingDate(row.bookingDate);

    if (!bookingDate) {
      invalidRows.push({
        rowNumber: index + 2,
        code: "INVALID_BOOKING_DATE",
        message: `Row ${index + 2} has unsupported booking date "${row.bookingDate}". Expected format DD.MM.YYYY.`,
      });
      continue;
    }

    validRows.push({
      ...row,
      bookingDate: bookingDate.toISOString().slice(0, 10),
      paymentType: normalizePaymentType(row.paymentType),
    });
  }

  return { validRows, invalidRows };
}

export async function importTransactionsFromCsv(
  db: ImportTransactionsDbClient,
  params: {
    accountId: string;
    csvContent: string;
  },
): Promise<ImportTransactionsResult> {
  const account = await db.account.findUnique({
    where: { id: params.accountId },
    select: { id: true },
  });

  if (!account) {
    throw new AccountNotFoundError(params.accountId);
  }

  const parsed = parseNorwegianBankCsv(params.csvContent);

  if (parsed.rows.length === 0) {
    return {
      summary: parsed.summary,
      errors: parsed.errors,
    };
  }

  const { validRows, invalidRows } = splitValidAndInvalidRows(parsed.rows);
  const existingTransactions = await db.transaction.findMany({
    where: { accountId: params.accountId },
    select: {
      bookingDate: true,
      amountNok: true,
      normalizedMerchant: true,
      paymentType: true,
    },
  });

  const existingFingerprints = buildExistingFingerprints(
    params.accountId,
    existingTransactions,
  );

  const dedupeResult = dedupeParsedTransactions(
    params.accountId,
    validRows,
    existingFingerprints,
  );

  if (dedupeResult.uniqueRows.length === 0) {
    return {
      summary: mergeSummary(
        parsed.summary,
        0,
        dedupeResult.duplicateCount,
        invalidRows.length,
      ),
      errors: [...parsed.errors, ...invalidRows],
    };
  }

  const insertResult = await db.transaction.createMany({
    data: dedupeResult.uniqueRows.map(({ row, normalizedMerchant }) => ({
      accountId: params.accountId,
      bookingDate: new Date(`${row.bookingDate}T00:00:00.000Z`),
      amountNok: row.amountNok,
      currency: row.currency,
      normalizedMerchant,
      paymentType: normalizePaymentType(row.paymentType),
    })),
  });

  return {
    summary: mergeSummary(
      parsed.summary,
      insertResult.count,
      dedupeResult.duplicateCount,
      invalidRows.length,
    ),
    errors: [...parsed.errors, ...invalidRows],
  };
}

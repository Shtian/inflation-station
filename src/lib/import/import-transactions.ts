import type { PaymentType } from "@prisma/client";
import {
  buildRuleBasedSuggestions,
  type CategoryRuleCandidate,
} from "../categorization/rule-engine";
import {
  type CsvValidationError,
  type ParsedCsvRow,
  parseNorwegianBankCsv,
} from "./csv-parser";
import { normalizeImportPaymentType } from "./normalization";
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
  categoryRule: {
    findMany(args: {
      where: {
        OR: Array<
          | {
              accountId: string;
            }
          | {
              accountId: null;
            }
        >;
      };
      select: {
        id: true;
        categoryId: true;
        merchantContains: true;
        paymentType: true;
        priority: true;
      };
      orderBy: [{ priority: "asc" }, { id: "asc" }];
    }): Promise<CategoryRuleCandidate[]>;
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
    create(args: {
      data: {
        accountId: string;
        bookingDate: Date;
        amountNok: number;
        currency: "NOK";
        normalizedMerchant: string;
        paymentType: PaymentType;
      };
      select: {
        id: true;
        normalizedMerchant: true;
        paymentType: true;
      };
    }): Promise<{
      id: string;
      normalizedMerchant: string;
      paymentType: PaymentType;
    }>;
  };
  categorizationSuggestion: {
    createMany(args: {
      data: Array<{
        transactionId: string;
        suggestedCategoryId: string;
        source: "RULE";
        confidence: number;
        reasoning: string;
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

function parseBookingDate(value: string): Date | null {
  const trimmed = value.trim();

  const buildUtcDate = (
    year: string,
    month: string,
    day: string,
  ): Date | null => {
    const yearNumber = Number.parseInt(year, 10);
    const monthNumber = Number.parseInt(month, 10);
    const dayNumber = Number.parseInt(day, 10);
    const parsed = new Date(
      Date.UTC(yearNumber, monthNumber - 1, dayNumber, 0, 0, 0, 0),
    );

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== yearNumber ||
      parsed.getUTCMonth() !== monthNumber - 1 ||
      parsed.getUTCDate() !== dayNumber
    ) {
      return null;
    }

    return parsed;
  };

  const norwegianDate = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (norwegianDate) {
    const [, day, month, year] = norwegianDate;
    return buildUtcDate(year, month, day);
  }

  const norwegianShortYearDate = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(trimmed);
  if (norwegianShortYearDate) {
    const [, day, month, year] = norwegianShortYearDate;
    const fullYear = (2000 + Number.parseInt(year, 10)).toString();
    return buildUtcDate(fullYear, month, day);
  }

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return buildUtcDate(year, month, day);
  }

  const slashIsoDate = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(trimmed);
  if (slashIsoDate) {
    const [, year, month, day] = slashIsoDate;
    return buildUtcDate(year, month, day);
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
        message: `Row ${index + 2} has unsupported booking date "${row.bookingDate}". Expected formats DD.MM.YYYY, DD.MM.YY, YYYY-MM-DD, or YYYY/MM/DD.`,
      });
      continue;
    }

    validRows.push({
      ...row,
      bookingDate: bookingDate.toISOString().slice(0, 10),
      paymentType: normalizeImportPaymentType(row.paymentType),
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
  const categoryRules = await db.categoryRule.findMany({
    where: {
      OR: [{ accountId: params.accountId }, { accountId: null }],
    },
    select: {
      id: true,
      categoryId: true,
      merchantContains: true,
      paymentType: true,
      priority: true,
    },
    orderBy: [{ priority: "asc" }, { id: "asc" }],
  });

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

  const insertedTransactions = await Promise.all(
    dedupeResult.uniqueRows.map(({ row, normalizedMerchant }) =>
      db.transaction.create({
        data: {
          accountId: params.accountId,
          bookingDate: new Date(`${row.bookingDate}T00:00:00.000Z`),
          amountNok: row.amountNok,
          currency: row.currency,
          normalizedMerchant,
          paymentType: normalizeImportPaymentType(row.paymentType),
        },
        select: {
          id: true,
          normalizedMerchant: true,
          paymentType: true,
        },
      }),
    ),
  );

  const ruleSuggestions = buildRuleBasedSuggestions(
    insertedTransactions,
    categoryRules,
  );
  const suggestions = ruleSuggestions;

  if (suggestions.length > 0) {
    await db.categorizationSuggestion.createMany({
      data: suggestions,
    });
  }

  return {
    summary: mergeSummary(
      parsed.summary,
      insertedTransactions.length,
      dedupeResult.duplicateCount,
      invalidRows.length,
    ),
    errors: [...parsed.errors, ...invalidRows],
  };
}

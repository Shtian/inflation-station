import { PaymentType } from "@prisma/client";
import {
  buildRuleBasedSuggestions,
  type CategoryRuleCandidate,
} from "../categorization/rule-engine";
import {
  type CsvValidationError,
  type ParsedCsvRow,
  parseNorwegianBankCsv,
} from "./csv-parser";

export type ReviewStageSummary = {
  imported: number;
  duplicates: number;
  ignoredReserved: number;
  invalid: number;
};

export type ReviewStageRow = {
  id: string;
  rowNumber: number;
  bookingDate: string;
  amountNok: number;
  currency: "NOK";
  normalizedMerchant: string;
  paymentType: PaymentType;
  sender: string;
  recipient: string;
  name: string;
  title: string;
  categoryId: string | null;
};

export type StageParsedImportResult = {
  summary: ReviewStageSummary;
  errors: CsvValidationError[];
  review: {
    sessionId: string | null;
    rows: ReviewStageRow[];
  };
};

type StagedImportRow = {
  rowNumber: number;
  bookingDate: Date;
  amountNok: number;
  currency: "NOK";
  normalizedMerchant: string;
  paymentType: PaymentType;
  sender: string;
  recipient: string;
  name: string;
  title: string;
  categoryId: string | null;
};

type ImportReviewStageDbClient = {
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
  importReviewSession: {
    create(args: {
      data: {
        accountId: string;
      };
      select: {
        id: true;
      };
    }): Promise<{ id: string }>;
  };
  importReviewRow: {
    createMany(args: {
      data: Array<{
        sessionId: string;
        rowNumber: number;
        bookingDate: Date;
        amountNok: number;
        currency: "NOK";
        normalizedMerchant: string;
        paymentType: PaymentType;
        sender: string;
        recipient: string;
        name: string;
        title: string;
        categoryId: string | null;
      }>;
    }): Promise<{ count: number }>;
    findMany(args: {
      where: {
        sessionId: string;
      };
      select: {
        id: true;
        rowNumber: true;
        bookingDate: true;
        amountNok: true;
        currency: true;
        normalizedMerchant: true;
        paymentType: true;
        sender: true;
        recipient: true;
        name: true;
        title: true;
        categoryId: true;
      };
      orderBy: {
        rowNumber: "asc";
      };
    }): Promise<
      Array<{
        id: string;
        rowNumber: number;
        bookingDate: Date;
        amountNok: { toString(): string } | number;
        currency: string;
        normalizedMerchant: string;
        paymentType: PaymentType;
        sender: string;
        recipient: string;
        name: string;
        title: string;
        categoryId: string | null;
      }>
    >;
  };
};

type ValidatedStageRow = {
  rowNumber: number;
  bookingDate: string;
  amountNok: number;
  currency: "NOK";
  paymentType: PaymentType;
  normalizedMerchant: string;
  sender: string;
  recipient: string;
  name: string;
  title: string;
};

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function normalizePaymentType(value: string): PaymentType {
  const normalized = normalizeToken(value);

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

function normalizeMerchant(row: ParsedCsvRow): string {
  return normalizeToken(
    [row.recipient, row.sender, row.name, row.title].join(" "),
  );
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

function splitValidAndInvalidRows(rows: ParsedCsvRow[]): {
  validRows: ValidatedStageRow[];
  invalidRows: CsvValidationError[];
} {
  const validRows: ValidatedStageRow[] = [];
  const invalidRows: CsvValidationError[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const bookingDate = parseBookingDate(row.bookingDate);

    if (!bookingDate) {
      invalidRows.push({
        rowNumber,
        code: "INVALID_BOOKING_DATE",
        message: `Row ${rowNumber} has unsupported booking date "${row.bookingDate}". Expected formats DD.MM.YYYY, YYYY-MM-DD, or YYYY/MM/DD.`,
      });
      continue;
    }

    validRows.push({
      rowNumber,
      bookingDate: bookingDate.toISOString().slice(0, 10),
      amountNok: row.amountNok,
      currency: row.currency,
      paymentType: normalizePaymentType(row.paymentType),
      normalizedMerchant: normalizeMerchant(row),
      sender: row.sender,
      recipient: row.recipient,
      name: row.name,
      title: row.title,
    });
  }

  return { validRows, invalidRows };
}

function toStagedRows(rows: ValidatedStageRow[]): StagedImportRow[] {
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    bookingDate: new Date(`${row.bookingDate}T00:00:00.000Z`),
    amountNok: row.amountNok,
    currency: row.currency,
    normalizedMerchant: row.normalizedMerchant,
    paymentType: row.paymentType,
    sender: row.sender,
    recipient: row.recipient,
    name: row.name,
    title: row.title,
    categoryId: null,
  }));
}

function buildSummary(
  parsedSummary: ReviewStageSummary,
  stagedRowCount: number,
  invalidDelta: number,
): ReviewStageSummary {
  return {
    imported: stagedRowCount,
    duplicates: parsedSummary.duplicates,
    ignoredReserved: parsedSummary.ignoredReserved,
    invalid: parsedSummary.invalid + invalidDelta,
  };
}

type RuleMatchSeed = {
  id: string;
  normalizedMerchant: string;
  paymentType: PaymentType;
};

async function buildPrefilledCategoryMap(
  db: ImportReviewStageDbClient,
  accountId: string,
  validRows: ValidatedStageRow[],
): Promise<Map<number, string>> {
  const categoryRules = await db.categoryRule.findMany({
    where: {
      OR: [{ accountId }, { accountId: null }],
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

  const suggestionSeeds: RuleMatchSeed[] = validRows.map((row) => ({
    id: `row-${row.rowNumber}`,
    normalizedMerchant: row.normalizedMerchant,
    paymentType: row.paymentType,
  }));
  const suggestions = buildRuleBasedSuggestions(suggestionSeeds, categoryRules);

  return suggestions.reduce((map, suggestion) => {
    const rowNumber = Number.parseInt(
      suggestion.transactionId.replace("row-", ""),
      10,
    );
    if (!Number.isNaN(rowNumber)) {
      map.set(rowNumber, suggestion.suggestedCategoryId);
    }
    return map;
  }, new Map<number, string>());
}

export async function stageParsedImportRows(
  db: ImportReviewStageDbClient,
  params: {
    accountId: string;
    csvContent: string;
  },
): Promise<StageParsedImportResult> {
  const parsed = parseNorwegianBankCsv(params.csvContent);

  if (parsed.rows.length === 0) {
    return {
      summary: parsed.summary,
      errors: parsed.errors,
      review: {
        sessionId: null,
        rows: [],
      },
    };
  }

  const { validRows, invalidRows } = splitValidAndInvalidRows(parsed.rows);

  if (validRows.length === 0) {
    return {
      summary: buildSummary(parsed.summary, 0, invalidRows.length),
      errors: [...parsed.errors, ...invalidRows],
      review: {
        sessionId: null,
        rows: [],
      },
    };
  }

  let prefilledCategoryByRowNumber = new Map<number, string>();
  try {
    prefilledCategoryByRowNumber = await buildPrefilledCategoryMap(
      db,
      params.accountId,
      validRows,
    );
  } catch {
    prefilledCategoryByRowNumber = new Map<number, string>();
  }

  const session = await db.importReviewSession.create({
    data: {
      accountId: params.accountId,
    },
    select: {
      id: true,
    },
  });

  await db.importReviewRow.createMany({
    data: toStagedRows(validRows).map((row) => {
      const prefilledCategoryId =
        prefilledCategoryByRowNumber.get(row.rowNumber) ?? null;
      return {
        sessionId: session.id,
        ...row,
        categoryId: prefilledCategoryId,
      };
    }),
  });

  const stagedRows = await db.importReviewRow.findMany({
    where: {
      sessionId: session.id,
    },
    select: {
      id: true,
      rowNumber: true,
      bookingDate: true,
      amountNok: true,
      currency: true,
      normalizedMerchant: true,
      paymentType: true,
      sender: true,
      recipient: true,
      name: true,
      title: true,
      categoryId: true,
    },
    orderBy: {
      rowNumber: "asc",
    },
  });

  return {
    summary: buildSummary(
      parsed.summary,
      stagedRows.length,
      invalidRows.length,
    ),
    errors: [...parsed.errors, ...invalidRows],
    review: {
      sessionId: session.id,
      rows: stagedRows.map((row) => ({
        id: row.id,
        rowNumber: row.rowNumber,
        bookingDate: row.bookingDate.toISOString().slice(0, 10),
        amountNok: Number.parseFloat(row.amountNok.toString()),
        currency: "NOK",
        normalizedMerchant: row.normalizedMerchant,
        paymentType: row.paymentType,
        sender: row.sender,
        recipient: row.recipient,
        name: row.name,
        title: row.title,
        categoryId: row.categoryId,
      })),
    },
  };
}

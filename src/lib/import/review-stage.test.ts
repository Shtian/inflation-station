import { PaymentType, type SuggestionSource } from "@prisma/client";
import type { Fetch } from "@typesafe-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import type { CategoryRuleCandidate } from "../categorization/rule-engine";
import type { CsvParserResult, ParsedCsvRow } from "./csv-parser";
import { stageParsedImportRows } from "./review-stage";

function systemOneResponse(choice: string, confidence: number) {
  return new Response(
    JSON.stringify({
      model: "jev-latest",
      answers: {
        pick: {
          type: "choice",
          choice,
          confidence,
          probabilities: { [choice]: confidence },
        },
      },
      usage: { input_tokens: 10, output_tokens: 2 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function buildParsedRow(overrides?: Partial<ParsedCsvRow>): ParsedCsvRow {
  return {
    bookingDate: "01.01.2026",
    amountNok: 100,
    currency: "NOK",
    sender: "Alice",
    recipient: "Shop A",
    name: "Groceries",
    title: "Friday",
    paymentType: "Kort",
    ...overrides,
  };
}

function buildParsedResult(
  rows: ParsedCsvRow[],
  overrides?: Partial<CsvParserResult>,
): CsvParserResult {
  return {
    rows,
    errors: [],
    summary: {
      imported: rows.length,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    },
    ...overrides,
  };
}

function createDbMock(options?: {
  categoryRules?: CategoryRuleCandidate[];
  throwOnCategoryRuleLookup?: boolean;
  categories?: Array<{
    id: string;
    name: string;
    classifierHint: string | null;
  }>;
  stagedRows?: Array<{
    id: string;
    rowNumber: number;
    bookingDate: Date;
    amountNok: number;
    currency: string;
    normalizedMerchant: string;
    paymentType: PaymentType;
    sender: string;
    recipient: string;
    name: string;
    title: string;
    categoryId: string | null;
    suggestionSource?: SuggestionSource | null;
    suggestionConfidence?: number | null;
  }>;
  existingTransactions?: Array<{
    bookingDate: Date;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: PaymentType;
    categoryId?: string | null;
  }>;
}) {
  const importReviewSession = {
    create: vi.fn(async () => ({ id: "session-1" })),
  };
  const importReviewRow = {
    createMany: vi.fn(async () => ({
      count: options?.stagedRows?.length ?? 0,
    })),
    findMany: vi.fn(async () =>
      (options?.stagedRows ?? []).map((row) => ({
        ...row,
        suggestionSource: row.suggestionSource ?? null,
        suggestionConfidence: row.suggestionConfidence ?? null,
      })),
    ),
  };

  async function runTransaction<T>(
    fn: (tx: {
      importReviewSession: typeof importReviewSession;
      importReviewRow: typeof importReviewRow;
    }) => Promise<T>,
  ): Promise<T> {
    return fn({ importReviewSession, importReviewRow });
  }

  const db = {
    category: {
      findMany: vi.fn(async () => options?.categories ?? []),
    },
    categoryRule: {
      findMany: vi.fn(async () => {
        if (options?.throwOnCategoryRuleLookup) {
          throw new Error("rule engine unavailable");
        }
        return options?.categoryRules ?? [];
      }),
    },
    importReviewSession,
    importReviewRow,
    transaction: {
      findMany: vi.fn(async () =>
        (options?.existingTransactions ?? []).map((transaction) => ({
          ...transaction,
          categoryId: transaction.categoryId ?? null,
        })),
      ),
    },
    $transaction: runTransaction,
  };

  return db;
}

describe("stageParsedImportRows", () => {
  it("stages canonical parser rows without parser-specific branching", async () => {
    const db = createDbMock({
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([
        buildParsedRow({ bookingDate: "2026-01-01" }),
      ]),
    });

    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
          suggestionSource: null,
          suggestionConfidence: null,
        },
      ],
    });
    expect(db.importReviewRow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ bookingDate: "desc" }, { rowNumber: "asc" }],
      }),
    );
    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    });
  });

  it("stages valid rows and returns review payload with row identifiers", async () => {
    const db = createDbMock({
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow()]),
    });

    expect(db.importReviewSession.create).toHaveBeenCalledWith({
      data: {
        accountId: "account-1",
        invalidCount: 0,
      },
      select: {
        id: true,
      },
    });
    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
          suggestionSource: null,
          suggestionConfidence: null,
        },
      ],
    });

    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    });
    expect(result.review).toEqual({
      sessionId: "session-1",
      potentialDuplicates: 0,
      rows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: "2026-01-01",
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
          suggestionSource: null,
          suggestionConfidence: null,
          potentialDuplicate: false,
        },
      ],
    });
  });

  it("keeps invalid booking dates out of staged rows and returns row-level validation errors", async () => {
    const db = createDbMock({ stagedRows: [] });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([
        buildParsedRow({ bookingDate: "32.01.2026" }),
      ]),
    });

    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    });
    expect(result.errors).toEqual([
      {
        rowNumber: 2,
        code: "INVALID_BOOKING_DATE",
        message:
          'Row 2 has unsupported booking date "32.01.2026". Expected formats DD.MM.YYYY, DD.MM.YY, YYYY-MM-DD, or YYYY/MM/DD.',
      },
    ]);
    expect(result.review).toEqual({
      sessionId: null,
      potentialDuplicates: 0,
      rows: [],
    });

    expect(db.importReviewSession.create).not.toHaveBeenCalled();
    expect(db.importReviewRow.createMany).not.toHaveBeenCalled();
  });

  it("accepts booking dates in DD.MM.YY format", async () => {
    const db = createDbMock({
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow({ bookingDate: "03.01.26" })]),
    });

    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    });
    expect(result.errors).toHaveLength(0);
    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
          suggestionSource: null,
          suggestionConfidence: null,
        },
      ],
    });
  });

  it("returns parser diagnostics and skips staging when the parser produced no data rows", async () => {
    const db = createDbMock();

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: {
        rows: [],
        errors: [
          {
            rowNumber: 2,
            code: "INVALID_AMOUNT",
            message: 'Row 2 has invalid amount "abc".',
          },
        ],
        summary: { imported: 0, duplicates: 0, ignoredReserved: 0, invalid: 1 },
      },
    });

    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    });
    expect(result.review).toEqual({
      sessionId: null,
      potentialDuplicates: 0,
      rows: [],
    });
    expect(db.importReviewSession.create).not.toHaveBeenCalled();
    expect(db.importReviewRow.createMany).not.toHaveBeenCalled();
  });

  it("prefills staged categoryId when deterministic rules match", async () => {
    const db = createDbMock({
      categoryRules: [
        {
          id: "rule-1",
          categoryId: "cat-groceries",
          merchantContains: "groceries",
          paymentType: PaymentType.CARD,
          priority: 10,
        },
      ],
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: "cat-groceries",
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow()]),
    });

    expect(db.categoryRule.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ accountId: "account-1" }, { accountId: null }],
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
    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: "cat-groceries",
          suggestionSource: "RULE",
          suggestionConfidence: 0.95,
        },
      ],
    });
    expect(result.review.rows[0]?.categoryId).toBe("cat-groceries");
    expect(result.review.rows[0]?.potentialDuplicate).toBe(false);
  });

  it("matches rules against the raw merchant text while keeping the stored merchant key unchanged", async () => {
    const db = createDbMock({
      categoryRules: [
        {
          id: "rule-1",
          categoryId: "cat-cafe",
          merchantContains: "cafe",
          paymentType: PaymentType.CARD,
          priority: 10,
        },
      ],
    });

    await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([
        buildParsedRow({ name: "", title: "Café Løkka", paymentType: "" }),
      ]),
    });

    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          normalizedMerchant: "caf lokka",
          paymentType: PaymentType.OTHER,
          categoryId: "cat-cafe",
          suggestionSource: "RULE",
          suggestionConfidence: 0.8,
        }),
      ],
    });
  });

  it("continues staging uncategorized rows when suggestion lookup fails", async () => {
    const db = createDbMock({
      throwOnCategoryRuleLookup: true,
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow()]),
    });

    expect(db.importReviewSession.create).toHaveBeenCalledOnce();
    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
          suggestionSource: null,
          suggestionConfidence: null,
        },
      ],
    });
    expect(result.summary.imported).toBe(1);
    expect(result.review.rows[0]?.categoryId).toBeNull();
    expect(result.review.rows[0]?.potentialDuplicate).toBe(false);
  });

  it("flags staged rows as potential duplicates when fingerprint already exists", async () => {
    const db = createDbMock({
      existingTransactions: [
        {
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
        },
      ],
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow()]),
    });

    expect(result.review.potentialDuplicates).toBe(1);
    expect(result.review.rows[0]?.potentialDuplicate).toBe(true);
  });

  it("computes duplicate warnings from normalized merchant and payment type values", async () => {
    const db = createDbMock({
      existingTransactions: [
        {
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          normalizedMerchant: "baer ol",
          paymentType: PaymentType.TRANSFER,
        },
      ],
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "baer ol",
          paymentType: PaymentType.TRANSFER,
          sender: "Alice",
          recipient: "Shop A",
          name: "Bær",
          title: "Øl",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([
        buildParsedRow({
          name: "Bær",
          title: "Øl",
          paymentType: "Overføring",
        }),
      ]),
    });

    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "baer ol",
          paymentType: PaymentType.TRANSFER,
          sender: "Alice",
          recipient: "Shop A",
          name: "Bær",
          title: "Øl",
          categoryId: null,
          suggestionSource: null,
          suggestionConfidence: null,
        },
      ],
    });
    expect(result.review.potentialDuplicates).toBe(1);
    expect(result.review.rows[0]?.potentialDuplicate).toBe(true);
  });

  it("flags every matching row as potential duplicate when duplicates exist within upload", async () => {
    const db = createDbMock({
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
        {
          id: "row-2",
          rowNumber: 3,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow(), buildParsedRow()]),
    });

    expect(result.review.potentialDuplicates).toBe(2);
    expect(result.review.rows).toEqual([
      expect.objectContaining({
        id: "row-1",
        rowNumber: 2,
        potentialDuplicate: true,
      }),
      expect.objectContaining({
        id: "row-2",
        rowNumber: 3,
        potentialDuplicate: true,
      }),
    ]);
  });

  it("does not call Jev for a row the rule engine already matched", async () => {
    const jevFetchImpl = vi.fn(async (_input: unknown, _init: RequestInit) =>
      systemOneResponse("uncategorized", 0.5),
    );
    const db = createDbMock({
      categoryRules: [
        {
          id: "rule-1",
          categoryId: "cat-groceries",
          merchantContains: "groceries",
          paymentType: PaymentType.CARD,
          priority: 10,
        },
      ],
      categories: [
        {
          id: "cat-entertainment",
          name: "Entertainment",
          classifierHint: null,
        },
      ],
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: "cat-groceries",
        },
        {
          id: "row-2",
          rowNumber: 3,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          amountNok: 50,
          currency: "NOK",
          normalizedMerchant: "cinema movie night",
          paymentType: PaymentType.CARD,
          sender: "Bob",
          recipient: "Cinema",
          name: "Cinema",
          title: "Movie Night",
          categoryId: null,
        },
      ],
    });

    await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([
        buildParsedRow(),
        buildParsedRow({
          amountNok: 50,
          sender: "Bob",
          recipient: "Cinema",
          name: "Cinema",
          title: "Movie Night",
          bookingDate: "02.01.2026",
        }),
      ]),
      jevApiKey: "test-key",
      jevFetchImpl: jevFetchImpl as unknown as Fetch,
    });

    expect(jevFetchImpl).toHaveBeenCalledTimes(1);
    const [, requestInit] = jevFetchImpl.mock.calls[0];
    const requestBody = JSON.parse((requestInit as RequestInit).body as string);
    expect(requestBody.state.title).toBe("Movie Night");
  });

  it("marks a rule-matched staged row's suggestionSource as RULE in the review payload", async () => {
    const jevFetchImpl = vi.fn(async (_input: unknown, _init: RequestInit) =>
      systemOneResponse("uncategorized", 0.5),
    );
    const db = createDbMock({
      categoryRules: [
        {
          id: "rule-1",
          categoryId: "cat-groceries",
          merchantContains: "groceries",
          paymentType: PaymentType.CARD,
          priority: 10,
        },
      ],
      categories: [
        {
          id: "cat-entertainment",
          name: "Entertainment",
          classifierHint: null,
        },
      ],
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: "cat-groceries",
          suggestionSource: "RULE",
          suggestionConfidence: 0.95,
        },
        {
          id: "row-2",
          rowNumber: 3,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          amountNok: 50,
          currency: "NOK",
          normalizedMerchant: "cinema movie night",
          paymentType: PaymentType.CARD,
          sender: "Bob",
          recipient: "Cinema",
          name: "Cinema",
          title: "Movie Night",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([
        buildParsedRow(),
        buildParsedRow({
          amountNok: 50,
          sender: "Bob",
          recipient: "Cinema",
          name: "Cinema",
          title: "Movie Night",
          bookingDate: "02.01.2026",
        }),
      ]),
      jevApiKey: "test-key",
      jevFetchImpl: jevFetchImpl as unknown as Fetch,
    });

    expect(result.review.rows).toContainEqual(
      expect.objectContaining({
        rowNumber: 2,
        id: "row-1",
        suggestionSource: "RULE",
      }),
    );
  });

  it("persists a JEV suggestion when Jev picks a real category for an unmatched row", async () => {
    const jevFetchImpl = vi.fn(async () =>
      systemOneResponse("cat-entertainment", 0.83),
    );
    const db = createDbMock({
      categories: [
        {
          id: "cat-entertainment",
          name: "Entertainment",
          classifierHint: null,
        },
      ],
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: "cat-entertainment",
          suggestionSource: "JEV",
          suggestionConfidence: 0.83,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow()]),
      jevApiKey: "test-key",
      jevFetchImpl: jevFetchImpl as unknown as Fetch,
    });

    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: "cat-entertainment",
          suggestionSource: "JEV",
          suggestionConfidence: 0.83,
        },
      ],
    });
    expect(result.review.rows[0]?.categoryId).toBe("cat-entertainment");
    expect(result.review.rows[0]?.suggestionSource).toBe("JEV");
    expect(result.review.rows[0]?.suggestionConfidence).toBe(0.83);
  });

  it("leaves a row uncategorized when Jev picks Uncategorized", async () => {
    const jevFetchImpl = vi.fn(async () =>
      systemOneResponse("uncategorized", 0.3),
    );
    const db = createDbMock({
      categories: [
        {
          id: "cat-entertainment",
          name: "Entertainment",
          classifierHint: null,
        },
      ],
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow()]),
      jevApiKey: "test-key",
      jevFetchImpl: jevFetchImpl as unknown as Fetch,
    });

    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
          suggestionSource: null,
          suggestionConfidence: null,
        },
      ],
    });
    expect(result.review.rows[0]?.categoryId).toBeNull();
  });

  it("suppresses a below-floor Jev suggestion", async () => {
    const jevFetchImpl = vi.fn(async () =>
      systemOneResponse("cat-entertainment", 0.05),
    );
    const db = createDbMock({
      categories: [
        {
          id: "cat-entertainment",
          name: "Entertainment",
          classifierHint: null,
        },
      ],
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow()]),
      jevApiKey: "test-key",
      jevFetchImpl: jevFetchImpl as unknown as Fetch,
    });

    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
          suggestionSource: null,
          suggestionConfidence: null,
        },
      ],
    });
    expect(result.review.rows[0]?.categoryId).toBeNull();
    expect(result.jevOutcomes).toEqual({
      ok: 0,
      uncategorized: 0,
      below_floor: 1,
      disabled: 0,
      key_missing: 0,
      timeout: 0,
      provider_error: 0,
    });
  });

  it("persists a Jev suggestion exactly at the confidence floor", async () => {
    const jevFetchImpl = vi.fn(async () =>
      systemOneResponse("cat-entertainment", 0.1),
    );
    const db = createDbMock({
      categories: [
        {
          id: "cat-entertainment",
          name: "Entertainment",
          classifierHint: null,
        },
      ],
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: "cat-entertainment",
          suggestionSource: "JEV",
          suggestionConfidence: 0.1,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow()]),
      jevApiKey: "test-key",
      jevFetchImpl: jevFetchImpl as unknown as Fetch,
    });

    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: "cat-entertainment",
          suggestionSource: "JEV",
          suggestionConfidence: 0.1,
        },
      ],
    });
    expect(result.review.rows[0]?.categoryId).toBe("cat-entertainment");
  });

  it("leaves a row uncategorized and does not throw when the Jev call is unavailable", async () => {
    const jevFetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "bad request" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
    );
    const db = createDbMock({
      categories: [
        {
          id: "cat-entertainment",
          name: "Entertainment",
          classifierHint: null,
        },
      ],
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      parsed: buildParsedResult([buildParsedRow()]),
      jevApiKey: "test-key",
      jevFetchImpl: jevFetchImpl as unknown as Fetch,
    });

    expect(db.importReviewSession.create).toHaveBeenCalledOnce();
    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
          suggestionSource: null,
          suggestionConfidence: null,
        },
      ],
    });
    expect(result.review.rows[0]?.categoryId).toBeNull();
    expect(result.jevOutcomes).toEqual({
      ok: 0,
      uncategorized: 0,
      below_floor: 0,
      disabled: 0,
      key_missing: 0,
      timeout: 0,
      provider_error: 1,
    });
  });

  describe("history stage", () => {
    const kiwiRow = buildParsedRow({
      name: "",
      title: "KIWI 0312 MAJORSTUEN",
      bookingDate: "02.01.2026",
      amountNok: 250,
    });
    const cinemaRow = buildParsedRow({
      name: "Cinema",
      title: "Movie Night",
      bookingDate: "03.01.2026",
      amountNok: 50,
    });

    it("suggests a past category for an unmatched row and sends only the rest to Jev", async () => {
      const jevFetchImpl = vi.fn(async (_input: unknown, _init: RequestInit) =>
        systemOneResponse("cat-entertainment", 0.83),
      );
      const db = createDbMock({
        categories: [
          {
            id: "cat-entertainment",
            name: "Entertainment",
            classifierHint: null,
          },
        ],
        existingTransactions: [
          {
            bookingDate: new Date("2025-12-01T00:00:00.000Z"),
            amountNok: 300,
            normalizedMerchant: "kiwi 0445 stovner",
            paymentType: PaymentType.CARD,
            categoryId: "cat-groceries",
          },
        ],
      });

      const result = await stageParsedImportRows(db, {
        accountId: "account-1",
        parsed: buildParsedResult([kiwiRow, cinemaRow]),
        jevApiKey: "test-key",
        jevFetchImpl: jevFetchImpl as unknown as Fetch,
      });

      expect(db.transaction.findMany).toHaveBeenCalledTimes(1);
      expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            rowNumber: 2,
            categoryId: "cat-groceries",
            suggestionSource: "HISTORY",
            suggestionConfidence: 1,
          }),
          expect.objectContaining({
            rowNumber: 3,
            categoryId: "cat-entertainment",
            suggestionSource: "JEV",
            suggestionConfidence: 0.83,
          }),
        ],
      });
      expect(jevFetchImpl).toHaveBeenCalledTimes(1);
      const [, requestInit] = jevFetchImpl.mock.calls[0];
      const requestBody = JSON.parse(
        (requestInit as RequestInit).body as string,
      );
      expect(requestBody.state.title).toBe("Movie Night");
      expect(result.jevOutcomes).toEqual({
        ok: 1,
        uncategorized: 0,
        below_floor: 0,
        disabled: 0,
        key_missing: 0,
        timeout: 0,
        provider_error: 0,
      });
    });

    it("lets a matching rule win over history", async () => {
      const jevFetchImpl = vi.fn(async () =>
        systemOneResponse("cat-entertainment", 0.83),
      );
      const db = createDbMock({
        categoryRules: [
          {
            id: "rule-1",
            categoryId: "cat-household",
            merchantContains: "kiwi",
            paymentType: null,
            priority: 10,
          },
        ],
        existingTransactions: [
          {
            bookingDate: new Date("2025-12-01T00:00:00.000Z"),
            amountNok: 300,
            normalizedMerchant: "kiwi 0445 stovner",
            paymentType: PaymentType.CARD,
            categoryId: "cat-groceries",
          },
        ],
      });

      const result = await stageParsedImportRows(db, {
        accountId: "account-1",
        parsed: buildParsedResult([kiwiRow]),
        jevApiKey: "test-key",
        jevFetchImpl: jevFetchImpl as unknown as Fetch,
      });

      expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            rowNumber: 2,
            categoryId: "cat-household",
            suggestionSource: "RULE",
          }),
        ],
      });
      expect(jevFetchImpl).not.toHaveBeenCalled();
      expect(result.jevOutcomes).toEqual({
        ok: 0,
        uncategorized: 0,
        below_floor: 0,
        disabled: 0,
        key_missing: 0,
        timeout: 0,
        provider_error: 0,
      });
    });

    it("ignores uncategorized past transactions and a split history", async () => {
      const db = createDbMock({
        categories: [
          {
            id: "cat-entertainment",
            name: "Entertainment",
            classifierHint: null,
          },
        ],
        existingTransactions: [
          {
            bookingDate: new Date("2025-12-01T00:00:00.000Z"),
            amountNok: 300,
            normalizedMerchant: "kiwi 0312 majorstuen",
            paymentType: PaymentType.CARD,
            categoryId: null,
          },
          {
            bookingDate: new Date("2025-12-02T00:00:00.000Z"),
            amountNok: 80,
            normalizedMerchant: "cinema movie night",
            paymentType: PaymentType.CARD,
            categoryId: "cat-entertainment",
          },
          {
            bookingDate: new Date("2025-12-03T00:00:00.000Z"),
            amountNok: 80,
            normalizedMerchant: "cinema movie night",
            paymentType: PaymentType.CARD,
            categoryId: "cat-dining",
          },
          {
            bookingDate: new Date("2025-12-04T00:00:00.000Z"),
            amountNok: 120,
            normalizedMerchant: "groceries friday",
            paymentType: PaymentType.CARD,
            categoryId: "cat-groceries",
          },
        ],
      });

      const result = await stageParsedImportRows(db, {
        accountId: "account-1",
        parsed: buildParsedResult([
          kiwiRow,
          cinemaRow,
          buildParsedRow({ bookingDate: "04.01.2026" }),
        ]),
      });

      expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            rowNumber: 2,
            categoryId: null,
            suggestionSource: null,
          }),
          expect.objectContaining({
            rowNumber: 3,
            categoryId: null,
            suggestionSource: null,
          }),
          expect.objectContaining({
            rowNumber: 4,
            categoryId: "cat-groceries",
            suggestionSource: "HISTORY",
            suggestionConfidence: 1,
          }),
        ],
      });
      expect(result.jevOutcomes).toEqual({
        ok: 0,
        uncategorized: 0,
        below_floor: 0,
        disabled: 0,
        key_missing: 2,
        timeout: 0,
        provider_error: 0,
      });
    });
  });
});

import { PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { CategoryRuleCandidate } from "../categorization/rule-engine";
import { stageParsedImportRows } from "./review-stage";

const HEADER =
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype";

function createDbMock(options?: {
  categoryRules?: CategoryRuleCandidate[];
  throwOnCategoryRuleLookup?: boolean;
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
  }>;
  existingTransactions?: Array<{
    bookingDate: Date;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: PaymentType;
  }>;
}) {
  return {
    categoryRule: {
      findMany: vi.fn(async () => {
        if (options?.throwOnCategoryRuleLookup) {
          throw new Error("rule engine unavailable");
        }
        return options?.categoryRules ?? [];
      }),
    },
    importReviewSession: {
      create: vi.fn(async () => ({ id: "session-1" })),
    },
    importReviewRow: {
      createMany: vi.fn(async () => ({
        count: options?.stagedRows?.length ?? 0,
      })),
      findMany: vi.fn(async () => options?.stagedRows ?? []),
    },
    transaction: {
      findMany: vi.fn(async () => options?.existingTransactions ?? []),
    },
  };
}

describe("stageParsedImportRows", () => {
  it("uses provider mapping to transform provider-specific headers into canonical staged rows", async () => {
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
      csvContent:
        "Dato;Belastning;Fra;Til;Beskrivelse;Melding;Valuta;Type\n2026-01-01;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
      providerMapping: {
        id: "provider-1",
        providerName: "Bank B",
        normalizationRules: {},
        fieldMappings: [
          {
            sourceField: "Dato",
            canonicalField: "bookingDate",
            transformRules: null,
          },
          {
            sourceField: "Belastning",
            canonicalField: "amount",
            transformRules: null,
          },
          {
            sourceField: "Fra",
            canonicalField: "sender",
            transformRules: null,
          },
          {
            sourceField: "Til",
            canonicalField: "recipient",
            transformRules: null,
          },
          {
            sourceField: "Beskrivelse",
            canonicalField: "name",
            transformRules: null,
          },
          {
            sourceField: "Melding",
            canonicalField: "title",
            transformRules: null,
          },
          {
            sourceField: "Valuta",
            canonicalField: "currency",
            transformRules: null,
          },
          {
            sourceField: "Type",
            canonicalField: "paymentType",
            transformRules: null,
          },
        ],
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
        },
      ],
    });
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

    const result = await stageParsedImportRows(
      db,
      {
        accountId: "account-1",
        csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
      },
      {
        openAiApiKey: null,
      },
    );

    expect(db.importReviewSession.create).toHaveBeenCalledWith({
      data: {
        accountId: "account-1",
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
      messageCleanupUnavailableReason: "key_missing",
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
          cleanedMessage: null,
          categoryId: null,
          potentialDuplicate: false,
        },
      ],
    });
  });

  it("keeps invalid booking dates out of staged rows and returns row-level validation errors", async () => {
    const db = createDbMock({ stagedRows: [] });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      csvContent: `${HEADER}\n32.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
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
          'Row 2 has unsupported booking date "32.01.2026". Expected formats DD.MM.YYYY, YYYY-MM-DD, or YYYY/MM/DD.',
      },
    ]);
    expect(result.review).toEqual({
      sessionId: null,
      potentialDuplicates: 0,
      messageCleanupUnavailableReason: null,
      rows: [],
    });

    expect(db.importReviewSession.create).not.toHaveBeenCalled();
    expect(db.importReviewRow.createMany).not.toHaveBeenCalled();
  });

  it("returns parser diagnostics and skips staging when CSV has no data rows", async () => {
    const db = createDbMock();

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      csvContent: "",
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
      messageCleanupUnavailableReason: null,
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
      csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
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
        },
      ],
    });
    expect(result.review.rows[0]?.categoryId).toBe("cat-groceries");
    expect(result.review.rows[0]?.potentialDuplicate).toBe(false);
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
      csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
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
        },
      ],
    });
    expect(result.summary.imported).toBe(1);
    expect(result.review.rows[0]?.categoryId).toBeNull();
    expect(result.review.rows[0]?.potentialDuplicate).toBe(false);
  });

  it("includes cleaned message suggestions when OpenAI cleanup returns results", async () => {
    const db = createDbMock({
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "joker oslo",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Joker #1234",
          title: "Oslo",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(
      db,
      {
        accountId: "account-1",
        csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Joker #1234;Oslo;NOK;Kort`,
      },
      {
        openAiApiKey: "test-key",
        buildOpenAiMessageCleanup: vi.fn(async () => ({
          suggestions: [{ rowNumber: 2, cleanedMessage: "Joker Oslo" }],
          unavailableReason: null,
        })),
      },
    );

    expect(result.review.messageCleanupUnavailableReason).toBeNull();
    expect(result.review.rows[0]?.cleanedMessage).toBe("Joker Oslo");
  });

  it("returns provider_error cleanup reason when cleanup service throws", async () => {
    const db = createDbMock({
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "joker oslo",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Joker #1234",
          title: "Oslo",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(
      db,
      {
        accountId: "account-1",
        csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Joker #1234;Oslo;NOK;Kort`,
      },
      {
        openAiApiKey: "test-key",
        buildOpenAiMessageCleanup: vi.fn(async () => {
          throw new Error("provider unavailable");
        }),
      },
    );

    expect(result.summary.imported).toBe(1);
    expect(result.review.messageCleanupUnavailableReason).toBe(
      "provider_error",
    );
    expect(result.review.rows[0]?.cleanedMessage).toBeNull();
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
      csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
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
      csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Bær;Øl;NOK;Overføring`,
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
      csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
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
});

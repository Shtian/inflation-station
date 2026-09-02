import { PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  ImportReviewSessionNotFoundError,
  InvalidImportReviewCategoryError,
  submitImportReview,
} from "./review-submit";

function createDbMock(options?: {
  session?: {
    id: string;
    accountId: string;
    invalidCount?: number;
    rows: Array<{
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
  } | null;
  validCategories?: Array<{ id: string }>;
}) {
  const importReviewSession = {
    findUnique: vi.fn(async () => {
      if (options?.session === undefined) {
        return {
          id: "session-1",
          accountId: "account-1",
          invalidCount: 1,
          rows: [
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
              categoryId: "cat-food",
            },
          ],
        };
      }

      if (options.session === null) {
        return null;
      }

      return { invalidCount: 0, ...options.session };
    }),
    delete: vi.fn(async () => ({ id: "session-1" })),
  };
  const category = {
    findMany: vi.fn(
      async () => options?.validCategories ?? [{ id: "cat-food" }],
    ),
  };
  const transactionModel = {
    createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({
      count: data.length,
    })),
  };

  // A plain async function, not `vi.fn()`-wrapped: wrapping it broke
  // TypeScript's inference of the generic `tx` parameter against the
  // widened structural `ImportReviewSubmitDbClient` type - same finding as
  // #46's `review-stage.test.ts`.
  async function runTransaction<T>(
    fn: (tx: {
      importReviewSession: typeof importReviewSession;
      category: typeof category;
      transaction: typeof transactionModel;
    }) => Promise<T>,
  ): Promise<T> {
    return fn({
      importReviewSession,
      category,
      transaction: transactionModel,
    });
  }

  return {
    importReviewSession,
    category,
    transaction: transactionModel,
    $transaction: runTransaction,
  };
}

describe("submitImportReview", () => {
  it("persists reviewed rows with edited categories and deletes the session", async () => {
    const db = createDbMock({
      validCategories: [{ id: "cat-transport" }],
    });

    const result = await submitImportReview(db, {
      sessionId: "session-1",
      rows: [
        {
          rowId: "row-1",
          categoryId: "cat-transport",
          selectedMessage: "Friday",
        },
      ],
    });

    expect(db.transaction.createMany).toHaveBeenCalledWith({
      data: [
        {
          accountId: "account-1",
          categoryId: "cat-transport",
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          merchant: "Friday",
          paymentType: PaymentType.CARD,
          note: null,
        },
      ],
    });
    expect(db.importReviewSession.delete).toHaveBeenCalledWith({
      where: {
        id: "session-1",
      },
    });
    expect(result.summary).toEqual({
      imported: 1,
      invalid: 1,
    });
  });

  it("inserts both occurrences when identical rows are submitted", async () => {
    const db = createDbMock({
      session: {
        id: "session-1",
        accountId: "account-1",
        invalidCount: 0,
        rows: [
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
      },
      validCategories: [],
    });

    const result = await submitImportReview(db, {
      sessionId: "session-1",
      rows: [
        { rowId: "row-1", categoryId: null, selectedMessage: "Friday" },
        { rowId: "row-2", categoryId: null, selectedMessage: "Friday" },
      ],
    });

    expect(db.transaction.createMany).toHaveBeenCalledWith({
      data: [
        {
          accountId: "account-1",
          categoryId: null,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          merchant: "Friday",
          paymentType: PaymentType.CARD,
          note: null,
        },
        {
          accountId: "account-1",
          categoryId: null,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          merchant: "Friday",
          paymentType: PaymentType.CARD,
          note: null,
        },
      ],
    });
    expect(result.summary).toEqual({
      imported: 2,
      invalid: 0,
    });
  });

  it("throws when the review session cannot be found", async () => {
    const db = createDbMock({
      session: null,
    });

    await expect(
      submitImportReview(db, {
        sessionId: "missing-session",
        rows: [],
      }),
    ).rejects.toBeInstanceOf(ImportReviewSessionNotFoundError);

    expect(db.transaction.createMany).not.toHaveBeenCalled();
    expect(db.importReviewSession.delete).not.toHaveBeenCalled();
  });

  it("throws when selected categories do not exist", async () => {
    const db = createDbMock({
      validCategories: [],
    });

    await expect(
      submitImportReview(db, {
        sessionId: "session-1",
        rows: [
          {
            rowId: "row-1",
            categoryId: "cat-not-allowed",
            selectedMessage: "Friday",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidImportReviewCategoryError);

    expect(db.transaction.createMany).not.toHaveBeenCalled();
    expect(db.importReviewSession.delete).not.toHaveBeenCalled();
  });

  it("uses selected message text when building persisted transaction data", async () => {
    const db = createDbMock({
      validCategories: [{ id: "cat-food" }],
    });

    await submitImportReview(db, {
      sessionId: "session-1",
      rows: [
        {
          rowId: "row-1",
          categoryId: "cat-food",
          selectedMessage: "Joker Trondheim",
        },
      ],
    });

    expect(db.transaction.createMany).toHaveBeenCalledWith({
      data: [
        {
          accountId: "account-1",
          categoryId: "cat-food",
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries joker trondheim",
          merchant: "Joker Trondheim",
          paymentType: PaymentType.CARD,
          note: null,
        },
      ],
    });
  });

  it("only imports selected rows when a partial subset is submitted", async () => {
    const db = createDbMock({
      session: {
        id: "session-1",
        accountId: "account-1",
        invalidCount: 0,
        rows: [
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
            bookingDate: new Date("2026-01-02T00:00:00.000Z"),
            amountNok: 200,
            currency: "NOK",
            normalizedMerchant: "fuel station",
            paymentType: PaymentType.CARD,
            sender: "Alice",
            recipient: "Shell",
            name: "Fuel",
            title: "Shell",
            categoryId: null,
          },
          {
            id: "row-3",
            rowNumber: 4,
            bookingDate: new Date("2026-01-03T00:00:00.000Z"),
            amountNok: 50,
            currency: "NOK",
            normalizedMerchant: "coffee shop",
            paymentType: PaymentType.CARD,
            sender: "Alice",
            recipient: "Kaffebrenneriet",
            name: "Coffee",
            title: "Kaffebrenneriet",
            categoryId: null,
          },
        ],
      },
      validCategories: [],
    });

    const result = await submitImportReview(db, {
      sessionId: "session-1",
      rows: [
        { rowId: "row-1", categoryId: null, selectedMessage: "Friday" },
        {
          rowId: "row-3",
          categoryId: null,
          selectedMessage: "Kaffebrenneriet",
        },
      ],
    });

    expect(db.transaction.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
        }),
        expect.objectContaining({
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          amountNok: 50,
        }),
      ],
    });
    expect(result.summary.imported).toBe(2);
  });

  it("summary.imported reflects only the selected rows, not all session rows", async () => {
    const db = createDbMock({
      session: {
        id: "session-1",
        accountId: "account-1",
        invalidCount: 0,
        rows: [
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
            bookingDate: new Date("2026-01-02T00:00:00.000Z"),
            amountNok: 200,
            currency: "NOK",
            normalizedMerchant: "fuel station",
            paymentType: PaymentType.CARD,
            sender: "Alice",
            recipient: "Shell",
            name: "Fuel",
            title: "Shell",
            categoryId: null,
          },
        ],
      },
      validCategories: [],
    });

    const result = await submitImportReview(db, {
      sessionId: "session-1",
      rows: [{ rowId: "row-1", categoryId: null, selectedMessage: "Friday" }],
    });

    expect(result.summary.imported).toBe(1);
  });

  it("rows not in params.rows are excluded from transaction.createMany", async () => {
    const db = createDbMock({
      session: {
        id: "session-1",
        accountId: "account-1",
        invalidCount: 0,
        rows: [
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
            bookingDate: new Date("2026-01-02T00:00:00.000Z"),
            amountNok: 200,
            currency: "NOK",
            normalizedMerchant: "fuel station",
            paymentType: PaymentType.CARD,
            sender: "Alice",
            recipient: "Shell",
            name: "Fuel",
            title: "Shell",
            categoryId: null,
          },
        ],
      },
      validCategories: [],
    });

    await submitImportReview(db, {
      sessionId: "session-1",
      rows: [{ rowId: "row-1", categoryId: null, selectedMessage: "Friday" }],
    });

    const callData = db.transaction.createMany.mock.calls[0][0].data;
    expect(callData).toHaveLength(1);
    expect(callData[0]).toMatchObject({ amountNok: 100 });
  });

  it("persists provided row note values", async () => {
    const db = createDbMock({
      validCategories: [{ id: "cat-food" }],
    });

    await submitImportReview(db, {
      sessionId: "session-1",
      rows: [
        {
          rowId: "row-1",
          categoryId: "cat-food",
          selectedMessage: "Friday",
          note: "Split dinner with family",
        },
      ],
    });

    expect(db.transaction.createMany).toHaveBeenCalledWith({
      data: [
        {
          accountId: "account-1",
          categoryId: "cat-food",
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          merchant: "Friday",
          paymentType: PaymentType.CARD,
          note: "Split dinner with family",
        },
      ],
    });
  });

  it("reads summary.invalid from the session's persisted invalidCount", async () => {
    const db = createDbMock({
      session: {
        id: "session-1",
        accountId: "account-1",
        invalidCount: 5,
        rows: [],
      },
    });

    const result = await submitImportReview(db, {
      sessionId: "session-1",
      rows: [],
    });

    expect(result.summary.invalid).toBe(5);
  });
});

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
  return {
    importReviewSession: {
      findUnique: vi.fn(async () =>
        options?.session === undefined
          ? {
              id: "session-1",
              accountId: "account-1",
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
            }
          : options.session,
      ),
      delete: vi.fn(async () => ({ id: "session-1" })),
    },
    category: {
      findMany: vi.fn(
        async () => options?.validCategories ?? [{ id: "cat-food" }],
      ),
    },
    transaction: {
      createMany: vi.fn(async ({ data }) => ({
        count: data.length,
      })),
    },
  };
}

describe("submitImportReview", () => {
  it("persists reviewed rows with edited categories and deletes the session", async () => {
    const db = createDbMock({
      validCategories: [{ id: "cat-transport" }],
    });

    const result = await submitImportReview(db, {
      sessionId: "session-1",
      invalidCount: 1,
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
      invalidCount: 0,
      rows: [],
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
        invalidCount: 0,
        rows: [],
      }),
    ).rejects.toBeInstanceOf(ImportReviewSessionNotFoundError);

    expect(db.transaction.createMany).not.toHaveBeenCalled();
    expect(db.importReviewSession.delete).not.toHaveBeenCalled();
  });

  it("throws when selected categories are not valid for the session account", async () => {
    const db = createDbMock({
      validCategories: [],
    });

    await expect(
      submitImportReview(db, {
        sessionId: "session-1",
        invalidCount: 0,
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
      invalidCount: 0,
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

  it("persists provided row note values", async () => {
    const db = createDbMock({
      validCategories: [{ id: "cat-food" }],
    });

    await submitImportReview(db, {
      sessionId: "session-1",
      invalidCount: 0,
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
});

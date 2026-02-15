import { SuggestionSource } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  CategoryNotFoundError,
  listPendingCategorizationReviews,
  submitCategorizationReview,
} from "./review-queue";

function createReviewQueueDbMock(options?: {
  suggestions?: Array<{
    id: string;
    source: SuggestionSource;
    confidence: number | null;
    reasoning: string | null;
    createdAt: Date;
    suggestedCategory: {
      id: string;
      name: string;
    };
    transaction: {
      id: string;
      bookingDate: Date;
      amountNok: number;
      normalizedMerchant: string;
      paymentType: string;
      categoryId: string | null;
    };
  }>;
  existingCategoryIds?: string[];
  updateCountsByTransactionId?: Record<string, number>;
}) {
  const suggestions = options?.suggestions ?? [];
  const existingCategoryIds = options?.existingCategoryIds ?? ["cat-food"];
  const updateCountsByTransactionId =
    options?.updateCountsByTransactionId ?? {};

  const tx = {
    categorizationSuggestion: {
      findMany: vi.fn(async () => suggestions),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    transaction: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async ({ where }) => ({
        count: updateCountsByTransactionId[where.id] ?? 1,
      })),
    },
    category: {
      findMany: vi.fn(async ({ where }) =>
        existingCategoryIds
          .filter((id) => where.id.in.includes(id))
          .map((id) => ({ id })),
      ),
    },
  };

  return {
    ...tx,
    $transaction: vi.fn(async (fn) => fn(tx)),
  };
}

describe("review-queue", () => {
  it("returns one deterministic pending suggestion per uncategorized transaction", async () => {
    const db = createReviewQueueDbMock({
      suggestions: [
        {
          id: "s-openai",
          source: SuggestionSource.OPENAI,
          confidence: 0.9,
          reasoning: "AI guess",
          createdAt: new Date("2026-02-15T09:00:00.000Z"),
          suggestedCategory: { id: "cat-food", name: "Food" },
          transaction: {
            id: "tx-1",
            bookingDate: new Date("2026-02-01T00:00:00.000Z"),
            amountNok: 120.5,
            normalizedMerchant: "coop extra",
            paymentType: "CARD",
            categoryId: null,
          },
        },
        {
          id: "s-rule",
          source: SuggestionSource.RULE,
          confidence: 0.7,
          reasoning: "Rule match",
          createdAt: new Date("2026-02-14T09:00:00.000Z"),
          suggestedCategory: { id: "cat-grocery", name: "Groceries" },
          transaction: {
            id: "tx-1",
            bookingDate: new Date("2026-02-01T00:00:00.000Z"),
            amountNok: 120.5,
            normalizedMerchant: "coop extra",
            paymentType: "CARD",
            categoryId: null,
          },
        },
      ],
    });

    const result = await listPendingCategorizationReviews(db);

    expect(result).toEqual([
      {
        transaction: {
          id: "tx-1",
          bookingDate: "2026-02-01",
          amountNok: 120.5,
          normalizedMerchant: "coop extra",
          paymentType: "CARD",
        },
        suggestion: {
          id: "s-rule",
          source: SuggestionSource.RULE,
          confidence: 0.7,
          reasoning: "Rule match",
          category: {
            id: "cat-grocery",
            name: "Groceries",
          },
        },
      },
    ]);
  });

  it("applies submitted decisions in batch and clears suggestions for submitted transactions", async () => {
    const db = createReviewQueueDbMock({
      existingCategoryIds: ["cat-food", "cat-rent"],
      updateCountsByTransactionId: {
        "tx-1": 1,
        "tx-2": 1,
      },
    });

    const result = await submitCategorizationReview(db, [
      { transactionId: "tx-1", categoryId: "cat-food" },
      { transactionId: "tx-2", categoryId: "cat-rent" },
    ]);

    expect(result).toEqual({ updated: 2, skipped: 0 });
    expect(db.transaction.updateMany).toHaveBeenCalledTimes(2);
    expect(db.categorizationSuggestion.deleteMany).toHaveBeenCalledWith({
      where: {
        transactionId: {
          in: ["tx-1", "tx-2"],
        },
      },
    });
  });

  it("does not finalize unsubmitted transactions and reports skipped rows", async () => {
    const db = createReviewQueueDbMock({
      existingCategoryIds: ["cat-food"],
      updateCountsByTransactionId: {
        "tx-1": 1,
      },
    });

    const result = await submitCategorizationReview(db, [
      { transactionId: "tx-1", categoryId: "cat-food" },
    ]);

    expect(result).toEqual({ updated: 1, skipped: 0 });
    expect(db.transaction.updateMany).toHaveBeenCalledTimes(1);
    expect(db.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: "tx-1",
        categoryId: null,
      },
      data: {
        categoryId: "cat-food",
      },
    });
  });

  it("throws explicit error when submitted category does not exist", async () => {
    const db = createReviewQueueDbMock({
      existingCategoryIds: [],
    });

    await expect(
      submitCategorizationReview(db, [
        { transactionId: "tx-1", categoryId: "cat-missing" },
      ]),
    ).rejects.toEqual(new CategoryNotFoundError(["cat-missing"]));

    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

import { MonthlyReviewStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getMonthlyTimeline, MONTHLY_TIMELINE_REVIEW_STATE } from "./timeline";

function createTimelineDbMock() {
  const reviews = [
    {
      monthStart: new Date("2026-01-01T00:00:00.000Z"),
      status: MonthlyReviewStatus.FAILED,
      generatedAt: null,
      errorMessage: "Provider timeout",
      reviewText: null,
    },
    {
      monthStart: new Date("2026-02-01T00:00:00.000Z"),
      status: MonthlyReviewStatus.GENERATED,
      generatedAt: new Date("2026-02-15T10:00:00.000Z"),
      errorMessage: null,
      reviewText: "Spend was elevated due to travel.",
    },
  ];

  return {
    transaction: {
      findMany: vi.fn(async () => [
        {
          id: "tx-1",
          bookingDate: new Date("2026-02-03T00:00:00.000Z"),
          amountNok: -200,
          category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
        },
        {
          id: "tx-2",
          bookingDate: new Date("2026-03-10T00:00:00.000Z"),
          amountNok: -400,
          category: { id: "cat-rent", name: "Rent", kind: "EXPENSE" },
        },
        {
          id: "tx-3",
          bookingDate: new Date("2026-03-12T00:00:00.000Z"),
          amountNok: 1000,
          category: { id: "cat-salary", name: "Salary", kind: "INCOME" },
        },
      ]),
    },
    monthlyReview: {
      findMany: vi.fn(async (args: { select: Record<string, boolean> }) => {
        if ("status" in args.select) {
          return reviews;
        }

        return reviews.map((review) => ({ monthStart: review.monthStart }));
      }),
    },
  };
}

describe("getMonthlyTimeline", () => {
  it("returns overview rows with explicit review states and metadata", async () => {
    const db = createTimelineDbMock();

    const rows = await getMonthlyTimeline(db);

    expect(rows).toEqual([
      {
        monthStart: "2026-03-01",
        totalSpendNok: 400,
        totalIncomeNok: 1000,
        monthlyBalanceNok: 600,
        transactionCount: 1,
        topCategory: {
          categoryId: "cat-rent",
          categoryName: "Rent",
          spendNok: 400,
        },
        categorySpendBreakdown: [
          {
            categoryId: "cat-rent",
            categoryName: "Rent",
            spendNok: 400,
          },
        ],
        monthOverMonthSpendDeltaNok: 200,
        reviewState: MONTHLY_TIMELINE_REVIEW_STATE.NOT_GENERATED,
        generatedAt: null,
        errorMessage: null,
        reviewText: null,
      },
      {
        monthStart: "2026-02-01",
        totalSpendNok: 200,
        totalIncomeNok: 0,
        monthlyBalanceNok: -200,
        transactionCount: 1,
        topCategory: {
          categoryId: "cat-food",
          categoryName: "Food",
          spendNok: 200,
        },
        categorySpendBreakdown: [
          {
            categoryId: "cat-food",
            categoryName: "Food",
            spendNok: 200,
          },
        ],
        monthOverMonthSpendDeltaNok: null,
        reviewState: MONTHLY_TIMELINE_REVIEW_STATE.GENERATED,
        generatedAt: "2026-02-15T10:00:00.000Z",
        errorMessage: null,
        reviewText: "Spend was elevated due to travel.",
      },
      {
        monthStart: "2026-01-01",
        totalSpendNok: 0,
        totalIncomeNok: 0,
        monthlyBalanceNok: 0,
        transactionCount: 0,
        topCategory: null,
        categorySpendBreakdown: [],
        monthOverMonthSpendDeltaNok: null,
        reviewState: MONTHLY_TIMELINE_REVIEW_STATE.FAILED,
        generatedAt: null,
        errorMessage: "Provider timeout",
        reviewText: null,
      },
    ]);
  });

  it("supports optional row limits", async () => {
    const db = createTimelineDbMock();

    const rows = await getMonthlyTimeline(db, { limit: 2 });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.monthStart).toBe("2026-03-01");
    expect(rows[1]?.monthStart).toBe("2026-02-01");
  });
});

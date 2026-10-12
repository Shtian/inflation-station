import { MonthlyReviewStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  buildMonthInReview,
  getMonthInReview,
  getMonthInReviewWithReview,
  type MonthInReviewTransactionRecord,
} from "./month-in-review";

// Transactions are stored as local midnight; pin a non-UTC zone so month and
// day bucketing is exercised the same way on every machine.
process.env.TZ = "Europe/Oslo";

const FOOD = { id: "cat-food", name: "Food", kind: "EXPENSE" };
const TRAVEL = { id: "cat-travel", name: "Travel", kind: "EXPENSE" };
const ELECTRONICS = {
  id: "cat-electronics",
  name: "Electronics",
  kind: "EXPENSE",
};
const SALARY = { id: "cat-salary", name: "Salary", kind: "INCOME" };
const TRANSFER = { id: "cat-transfer", name: "Transfer", kind: "TRANSFER" };

function tx(
  id: string,
  isoDate: string,
  amountNok: number,
  normalizedMerchant: string,
  category: MonthInReviewTransactionRecord["category"],
): MonthInReviewTransactionRecord {
  return {
    id,
    bookingDate: new Date(`${isoDate}T10:00:00.000Z`),
    amountNok,
    normalizedMerchant,
    category,
  };
}

const februaryTransactions = [
  tx("feb-salary", "2026-02-01", 30000, "EMPLOYER", SALARY),
  tx("feb-bonus", "2026-02-15", 2000, "EMPLOYER", SALARY),
  tx("feb-nav", "2026-02-10", 1500, "NAV", null),
  tx("feb-tax", "2026-02-11", 400, "SKATTEETATEN", null),
  tx("feb-unknown-income", "2026-02-12", 100, "", null),
  tx("feb-transfer-out", "2026-02-03", -5000, "SAVINGS", TRANSFER),
  tx("feb-transfer-in", "2026-02-03", 5000, "CHECKING", TRANSFER),
  tx("feb-rema-1", "2026-02-02", -700, "REMA 1000", FOOD),
  tx("feb-rema-2", "2026-02-04", -300, "REMA 1000", FOOD),
  tx("feb-vy", "2026-02-04", -500, "VY", TRAVEL),
  tx("feb-uncat", "2026-02-04", -100, "  ", null),
  tx("feb-elkjop", "2026-02-14", -2400, "ELKJOP", ELECTRONICS),
  tx("feb-kiwi", "2026-02-20", -200, "KIWI", FOOD),
  tx("feb-narvesen", "2026-02-25", -50, "NARVESEN", FOOD),
];

const januaryTransactions = [
  tx("jan-salary", "2026-01-01", 30000, "EMPLOYER", SALARY),
  tx("jan-transfer", "2026-01-05", -1000, "SAVINGS", TRANSFER),
  tx("jan-rema", "2026-01-10", -1500, "REMA 1000", FOOD),
  tx("jan-vy", "2026-01-12", -200, "VY", TRAVEL),
];

describe("buildMonthInReview", () => {
  it("builds cashflow, category movers, merchants, income sources, and moments for a month", () => {
    const result = buildMonthInReview({
      monthStart: "2026-02-01",
      monthTransactions: februaryTransactions,
      previousMonthTransactions: januaryTransactions,
    });

    expect(result).toEqual({
      monthStart: "2026-02-01",
      cashflow: {
        incomeNok: 34000,
        spendNok: 4250,
        netNok: 29750,
        savingsRate: 29750 / 34000,
      },
      previousMonth: {
        monthStart: "2026-01-01",
        incomeNok: 30000,
        spendNok: 1700,
        netNok: 28300,
      },
      spendTransactionCount: 7,
      categories: [
        {
          categoryId: "cat-electronics",
          categoryName: "Electronics",
          spendNok: 2400,
          share: 2400 / 4250,
          transactionCount: 1,
          deltaNok: 2400,
        },
        {
          categoryId: "cat-food",
          categoryName: "Food",
          spendNok: 1250,
          share: 1250 / 4250,
          transactionCount: 4,
          deltaNok: -250,
        },
        {
          categoryId: "cat-travel",
          categoryName: "Travel",
          spendNok: 500,
          share: 500 / 4250,
          transactionCount: 1,
          deltaNok: 300,
        },
        {
          categoryId: null,
          categoryName: "Uncategorized",
          spendNok: 100,
          share: 100 / 4250,
          transactionCount: 1,
          deltaNok: 100,
        },
      ],
      topMerchants: [
        {
          merchant: "ELKJOP",
          spendNok: 2400,
          share: 2400 / 4250,
          transactionCount: 1,
        },
        {
          merchant: "REMA 1000",
          spendNok: 1000,
          share: 1000 / 4250,
          transactionCount: 2,
        },
        {
          merchant: "VY",
          spendNok: 500,
          share: 500 / 4250,
          transactionCount: 1,
        },
        {
          merchant: "KIWI",
          spendNok: 200,
          share: 200 / 4250,
          transactionCount: 1,
        },
        {
          merchant: "Unknown merchant",
          spendNok: 100,
          share: 100 / 4250,
          transactionCount: 1,
        },
      ],
      incomeSources: [
        { source: "EMPLOYER", amountNok: 32000 },
        { source: "NAV", amountNok: 1500 },
        { source: "SKATTEETATEN", amountNok: 400 },
      ],
      biggestPurchase: {
        bookingDate: "2026-02-14",
        merchant: "ELKJOP",
        amountNok: 2400,
        categoryName: "Electronics",
      },
      busiestDay: {
        bookingDate: "2026-02-04",
        spendNok: 900,
        transactionCount: 3,
      },
    });
  });

  it("leaves comparisons and savings rate empty when there is no prior month or income", () => {
    const result = buildMonthInReview({
      monthStart: "2026-02-01",
      monthTransactions: [
        tx("feb-a", "2026-02-02", -300, "REMA 1000", null),
        tx("feb-b", "2026-02-09", -450, "VY", TRAVEL),
      ],
      previousMonthTransactions: [],
    });

    expect(result.cashflow).toEqual({
      incomeNok: 0,
      spendNok: 750,
      netNok: -750,
      savingsRate: null,
    });
    expect(result.previousMonth).toBeNull();
    expect(result.categories.map((category) => category.deltaNok)).toEqual([
      null,
      null,
    ]);
    expect(result.incomeSources).toEqual([]);
    expect(result.biggestPurchase).toEqual({
      bookingDate: "2026-02-09",
      merchant: "VY",
      amountNok: 450,
      categoryName: "Travel",
    });
    expect(result.busiestDay).toEqual({
      bookingDate: "2026-02-09",
      spendNok: 450,
      transactionCount: 1,
    });
  });

  it("returns empty facts for a month with only transfers", () => {
    const result = buildMonthInReview({
      monthStart: "2026-02-01",
      monthTransactions: [
        tx("feb-transfer", "2026-02-03", -5000, "SAVINGS", TRANSFER),
      ],
      previousMonthTransactions: [],
    });

    expect(result).toEqual({
      monthStart: "2026-02-01",
      cashflow: { incomeNok: 0, spendNok: 0, netNok: 0, savingsRate: null },
      previousMonth: null,
      spendTransactionCount: 0,
      categories: [],
      topMerchants: [],
      incomeSources: [],
      biggestPurchase: null,
      busiestDay: null,
    });
  });
});

describe("getMonthInReview", () => {
  it("queries the month and the prior month using local calendar bounds", async () => {
    const findMany = vi.fn(
      async ({ where }: { where: { bookingDate: { gte: Date } } }) =>
        where.bookingDate.gte.getMonth() === 0
          ? januaryTransactions
          : februaryTransactions,
    );

    const result = await getMonthInReview(
      { transaction: { findMany } },
      { monthStart: "2026-02-01" },
    );

    expect(findMany.mock.calls.map(([args]) => args.where.bookingDate)).toEqual(
      [
        {
          gte: new Date("2026-01-31T23:00:00.000Z"),
          lt: new Date("2026-02-28T23:00:00.000Z"),
        },
        {
          gte: new Date("2025-12-31T23:00:00.000Z"),
          lt: new Date("2026-01-31T23:00:00.000Z"),
        },
      ],
    );
    expect(result.cashflow.netNok).toBe(29750);
    expect(result.previousMonth?.spendNok).toBe(1700);
  });

  it("throws stable error for invalid monthStart input", async () => {
    const findMany = vi.fn(async () => []);

    await expect(
      getMonthInReview(
        { transaction: { findMany } },
        { monthStart: "2026-13-01" },
      ),
    ).rejects.toThrow("MONTH_START_INVALID");
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("getMonthInReviewWithReview", () => {
  it("attaches the persisted review state and text", async () => {
    const result = await getMonthInReviewWithReview(
      {
        transaction: { findMany: vi.fn(async () => []) },
        monthlyReview: {
          findUnique: vi.fn(async () => ({
            status: MonthlyReviewStatus.GENERATED,
            generatedAt: new Date("2026-03-02T08:00:00.000Z"),
            errorMessage: null,
            reviewText: "Februar gikk i pluss.",
          })),
        },
      },
      { monthStart: "2026-02-01" },
    );

    expect(result.reviewState).toBe("GENERATED");
    expect(result.generatedAt).toBe("2026-03-02T08:00:00.000Z");
    expect(result.reviewText).toBe("Februar gikk i pluss.");
  });

  it("reports NOT_GENERATED when no review row exists", async () => {
    const findUnique = vi.fn(async () => null);

    const result = await getMonthInReviewWithReview(
      {
        transaction: { findMany: vi.fn(async () => []) },
        monthlyReview: { findUnique },
      },
      { monthStart: "2026-02-01" },
    );

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { monthStart: new Date("2026-02-01T00:00:00.000Z") },
      }),
    );
    expect(result).toMatchObject({
      reviewState: "NOT_GENERATED",
      generatedAt: null,
      errorMessage: null,
      reviewText: null,
    });
  });
});

describe("local calendar months", () => {
  it("counts a row booked at local midnight on the 1st in that month and day", async () => {
    const localFirstOfSeptember = new Date(2026, 8, 1);
    expect(localFirstOfSeptember.toISOString()).toBe(
      "2026-08-31T22:00:00.000Z",
    );
    const rows: MonthInReviewTransactionRecord[] = [
      {
        id: "sep-rent",
        bookingDate: localFirstOfSeptember,
        amountNok: -20377,
        normalizedMerchant: "LANDLORD",
        category: { id: "cat-rent", name: "Rent", kind: "EXPENSE" },
      },
    ];
    const findMany = vi.fn(
      async ({ where }: { where: { bookingDate: { gte: Date; lt: Date } } }) =>
        rows.filter(
          (row) =>
            row.bookingDate >= where.bookingDate.gte &&
            row.bookingDate < where.bookingDate.lt,
        ),
    );

    const result = await getMonthInReview(
      { transaction: { findMany } },
      { monthStart: "2026-09-01" },
    );

    expect(result.cashflow.spendNok).toBe(20377);
    expect(result.previousMonth).toBeNull();
    expect(result.biggestPurchase).toEqual({
      bookingDate: "2026-09-01",
      merchant: "LANDLORD",
      amountNok: 20377,
      categoryName: "Rent",
    });
    expect(result.busiestDay).toEqual({
      bookingDate: "2026-09-01",
      spendNok: 20377,
      transactionCount: 1,
    });
  });
});

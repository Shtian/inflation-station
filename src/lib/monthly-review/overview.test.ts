import { describe, expect, it, vi } from "vitest";
import { getMonthlyOverview } from "./overview";

function createMonthlyOverviewDbMock(
  transactions: Array<{
    id: string;
    bookingDate: Date;
    amountNok: number;
    category: {
      id: string;
      name: string;
      kind: "EXPENSE" | "INCOME" | "TRANSFER";
    } | null;
  }>,
  reviews: Array<{
    monthStart: Date;
  }> = [],
) {
  return {
    transaction: {
      findMany: vi.fn(async () => transactions),
    },
    monthlyReview: {
      findMany: vi.fn(async () => reviews),
    },
  };
}

describe("monthly overview", () => {
  it("builds deterministic month rows with spend totals, top category, and mom delta", async () => {
    const db = createMonthlyOverviewDbMock([
      {
        id: "tx-jan-food-1",
        bookingDate: new Date("2026-01-15T10:00:00.000Z"),
        amountNok: -200,
        category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
      },
      {
        id: "tx-jan-food-2",
        bookingDate: new Date("2026-01-20T10:00:00.000Z"),
        amountNok: -100,
        category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
      },
      {
        id: "tx-feb-income",
        bookingDate: new Date("2026-02-01T10:00:00.000Z"),
        amountNok: 3000,
        category: { id: "cat-salary", name: "Salary", kind: "INCOME" },
      },
      {
        id: "tx-feb-travel",
        bookingDate: new Date("2026-02-05T10:00:00.000Z"),
        amountNok: -500,
        category: { id: "cat-travel", name: "Travel", kind: "EXPENSE" },
      },
      {
        id: "tx-mar-uncat",
        bookingDate: new Date("2026-03-04T10:00:00.000Z"),
        amountNok: -100,
        category: null,
      },
    ]);

    const result = await getMonthlyOverview(db);

    expect(result).toEqual([
      {
        monthStart: "2026-03-01",
        totalSpendNok: 100,
        transactionCount: 1,
        topCategory: {
          categoryId: null,
          categoryName: "Uncategorized",
          spendNok: 100,
        },
        categorySpendBreakdown: [
          {
            categoryId: null,
            categoryName: "Uncategorized",
            spendNok: 100,
          },
        ],
        monthOverMonthSpendDeltaNok: -400,
      },
      {
        monthStart: "2026-02-01",
        totalSpendNok: 500,
        transactionCount: 1,
        topCategory: {
          categoryId: "cat-travel",
          categoryName: "Travel",
          spendNok: 500,
        },
        categorySpendBreakdown: [
          {
            categoryId: "cat-travel",
            categoryName: "Travel",
            spendNok: 500,
          },
        ],
        monthOverMonthSpendDeltaNok: 200,
      },
      {
        monthStart: "2026-01-01",
        totalSpendNok: 300,
        transactionCount: 2,
        topCategory: {
          categoryId: "cat-food",
          categoryName: "Food",
          spendNok: 300,
        },
        categorySpendBreakdown: [
          {
            categoryId: "cat-food",
            categoryName: "Food",
            spendNok: 300,
          },
        ],
        monthOverMonthSpendDeltaNok: null,
      },
    ]);
  });

  it("includes review-only months even when no transactions exist", async () => {
    const db = createMonthlyOverviewDbMock(
      [],
      [{ monthStart: new Date("2026-04-01T00:00:00.000Z") }],
    );

    const result = await getMonthlyOverview(db);

    expect(result).toEqual([
      {
        monthStart: "2026-04-01",
        totalSpendNok: 0,
        transactionCount: 0,
        topCategory: null,
        categorySpendBreakdown: [],
        monthOverMonthSpendDeltaNok: null,
      },
    ]);
  });

  it("excludes transfer-category spend while still including uncategorized spend", async () => {
    const db = createMonthlyOverviewDbMock([
      {
        id: "tx-jan-expense",
        bookingDate: new Date("2026-01-08T10:00:00.000Z"),
        amountNok: -400,
        category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
      },
      {
        id: "tx-jan-transfer",
        bookingDate: new Date("2026-01-12T10:00:00.000Z"),
        amountNok: -900,
        category: { id: "cat-transfer", name: "Move", kind: "TRANSFER" },
      },
      {
        id: "tx-feb-transfer",
        bookingDate: new Date("2026-02-03T10:00:00.000Z"),
        amountNok: -300,
        category: { id: "cat-transfer", name: "Move", kind: "TRANSFER" },
      },
      {
        id: "tx-feb-uncat",
        bookingDate: new Date("2026-02-05T10:00:00.000Z"),
        amountNok: -200,
        category: null,
      },
    ]);

    const result = await getMonthlyOverview(db);

    expect(result).toEqual([
      {
        monthStart: "2026-02-01",
        totalSpendNok: 200,
        transactionCount: 1,
        topCategory: {
          categoryId: null,
          categoryName: "Uncategorized",
          spendNok: 200,
        },
        categorySpendBreakdown: [
          {
            categoryId: null,
            categoryName: "Uncategorized",
            spendNok: 200,
          },
        ],
        monthOverMonthSpendDeltaNok: -200,
      },
      {
        monthStart: "2026-01-01",
        totalSpendNok: 400,
        transactionCount: 1,
        topCategory: {
          categoryId: "cat-food",
          categoryName: "Food",
          spendNok: 400,
        },
        categorySpendBreakdown: [
          {
            categoryId: "cat-food",
            categoryName: "Food",
            spendNok: 400,
          },
        ],
        monthOverMonthSpendDeltaNok: null,
      },
    ]);
  });

  it("uses deterministic tie-breaking for top category by name", async () => {
    const db = createMonthlyOverviewDbMock([
      {
        id: "tx-1",
        bookingDate: new Date("2026-01-10T10:00:00.000Z"),
        amountNok: -200,
        category: { id: "cat-z", name: "Zeta", kind: "EXPENSE" },
      },
      {
        id: "tx-2",
        bookingDate: new Date("2026-01-11T10:00:00.000Z"),
        amountNok: -200,
        category: { id: "cat-a", name: "Alpha", kind: "EXPENSE" },
      },
    ]);

    const [row] = await getMonthlyOverview(db);

    expect(row.topCategory).toEqual({
      categoryId: "cat-a",
      categoryName: "Alpha",
      spendNok: 200,
    });

    expect(row.categorySpendBreakdown).toEqual([
      {
        categoryId: "cat-a",
        categoryName: "Alpha",
        spendNok: 200,
      },
      {
        categoryId: "cat-z",
        categoryName: "Zeta",
        spendNok: 200,
      },
    ]);
  });

  it("queries transactions and monthly reviews with deterministic ordering", async () => {
    const db = createMonthlyOverviewDbMock([]);

    await getMonthlyOverview(db);

    expect(db.transaction.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        bookingDate: true,
        amountNok: true,
        category: {
          select: {
            id: true,
            name: true,
            kind: true,
          },
        },
      },
      orderBy: [{ bookingDate: "asc" }, { id: "asc" }],
    });

    expect(db.monthlyReview.findMany).toHaveBeenCalledWith({
      select: {
        monthStart: true,
      },
      orderBy: [{ monthStart: "asc" }],
    });
  });
});

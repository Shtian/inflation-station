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
        category: { id: "cat-food", name: "Food" },
      },
      {
        id: "tx-jan-food-2",
        bookingDate: new Date("2026-01-20T10:00:00.000Z"),
        amountNok: -100,
        category: { id: "cat-food", name: "Food" },
      },
      {
        id: "tx-feb-income",
        bookingDate: new Date("2026-02-01T10:00:00.000Z"),
        amountNok: 3000,
        category: { id: "cat-salary", name: "Salary" },
      },
      {
        id: "tx-feb-travel",
        bookingDate: new Date("2026-02-05T10:00:00.000Z"),
        amountNok: -500,
        category: { id: "cat-travel", name: "Travel" },
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
        category: { id: "cat-z", name: "Zeta" },
      },
      {
        id: "tx-2",
        bookingDate: new Date("2026-01-11T10:00:00.000Z"),
        amountNok: -200,
        category: { id: "cat-a", name: "Alpha" },
      },
    ]);

    const [row] = await getMonthlyOverview(db);

    expect(row.topCategory).toEqual({
      categoryId: "cat-a",
      categoryName: "Alpha",
      spendNok: 200,
    });
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

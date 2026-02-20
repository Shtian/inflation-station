import { describe, expect, it, vi } from "vitest";
import { getDashboardAnalytics } from "./analytics";

function createAnalyticsDbMock(
  transactions: Array<{
    id: string;
    bookingDate: Date;
    amountNok: number;
    account: {
      id: string;
      name: string;
    };
    category: {
      id: string;
      name: string;
      kind: "EXPENSE" | "INCOME" | "TRANSFER";
    } | null;
  }>,
) {
  return {
    transaction: {
      findMany: vi.fn(async () => transactions),
    },
  };
}

describe("analytics", () => {
  it("builds net cashflow and inflow/outflow series by day", async () => {
    const db = createAnalyticsDbMock([
      {
        id: "tx-1",
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: 1000,
        account: { id: "acc-1", name: "Main" },
        category: null,
      },
      {
        id: "tx-2",
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: -200,
        account: { id: "acc-1", name: "Main" },
        category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
      },
      {
        id: "tx-3",
        bookingDate: new Date("2026-02-02T00:00:00.000Z"),
        amountNok: -50,
        account: { id: "acc-2", name: "Savings" },
        category: null,
      },
    ]);

    const result = await getDashboardAnalytics(db);

    expect(result.netCashflow).toEqual([
      { date: "2026-02-01", netNok: 800 },
      { date: "2026-02-02", netNok: -50 },
    ]);
    expect(result.inflowOutflow).toEqual([
      { date: "2026-02-01", inflowNok: 1000, outflowNok: 200 },
      { date: "2026-02-02", inflowNok: 0, outflowNok: 50 },
    ]);
  });

  it("builds category breakdown from spending and includes uncategorized rows", async () => {
    const db = createAnalyticsDbMock([
      {
        id: "tx-1",
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: -250.5,
        account: { id: "acc-1", name: "Main" },
        category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
      },
      {
        id: "tx-2",
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: -10,
        account: { id: "acc-1", name: "Main" },
        category: null,
      },
      {
        id: "tx-3",
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: 1200,
        account: { id: "acc-1", name: "Main" },
        category: { id: "cat-salary", name: "Salary", kind: "INCOME" },
      },
    ]);

    const result = await getDashboardAnalytics(db);

    expect(result.categoryBreakdown).toEqual([
      {
        categoryId: "cat-food",
        categoryName: "Food",
        spendNok: 250.5,
        transactionCount: 1,
      },
      {
        categoryId: null,
        categoryName: "Uncategorized",
        spendNok: 10,
        transactionCount: 1,
      },
    ]);
  });

  it("builds account trend with deterministic per-account cumulative totals", async () => {
    const db = createAnalyticsDbMock([
      {
        id: "tx-1",
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: 500,
        account: { id: "acc-main", name: "Main" },
        category: null,
      },
      {
        id: "tx-2",
        bookingDate: new Date("2026-02-03T00:00:00.000Z"),
        amountNok: -100,
        account: { id: "acc-main", name: "Main" },
        category: null,
      },
      {
        id: "tx-3",
        bookingDate: new Date("2026-02-02T00:00:00.000Z"),
        amountNok: 300,
        account: { id: "acc-save", name: "Savings" },
        category: null,
      },
    ]);

    const result = await getDashboardAnalytics(db);

    expect(result.accountTrend).toEqual([
      {
        accountId: "acc-main",
        accountName: "Main",
        points: [
          { date: "2026-02-01", netNok: 500, cumulativeNok: 500 },
          { date: "2026-02-03", netNok: -100, cumulativeNok: 400 },
        ],
      },
      {
        accountId: "acc-save",
        accountName: "Savings",
        points: [{ date: "2026-02-02", netNok: 300, cumulativeNok: 300 }],
      },
    ]);
  });

  it("forwards account/date filters to transaction query", async () => {
    const db = createAnalyticsDbMock([]);
    const startDate = new Date("2026-01-01T00:00:00.000Z");
    const endDate = new Date("2026-01-31T00:00:00.000Z");

    await getDashboardAnalytics(db, {
      accountId: "acc-1",
      startDate,
      endDate,
    });

    expect(db.transaction.findMany).toHaveBeenCalledWith({
      where: {
        accountId: "acc-1",
        bookingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        bookingDate: true,
        amountNok: true,
        account: {
          select: {
            id: true,
            name: true,
          },
        },
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
  });

  it("excludes transfer-category rows from net, inflow/outflow, and spend breakdown", async () => {
    const db = createAnalyticsDbMock([
      {
        id: "tx-1",
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: 1000,
        account: { id: "acc-1", name: "Main" },
        category: { id: "cat-salary", name: "Salary", kind: "INCOME" },
      },
      {
        id: "tx-2",
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: -300,
        account: { id: "acc-1", name: "Main" },
        category: { id: "cat-transfer", name: "Transfer", kind: "TRANSFER" },
      },
      {
        id: "tx-3",
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: -200,
        account: { id: "acc-1", name: "Main" },
        category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
      },
      {
        id: "tx-4",
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: -100,
        account: { id: "acc-1", name: "Main" },
        category: null,
      },
    ]);

    const result = await getDashboardAnalytics(db);

    expect(result.netCashflow).toEqual([{ date: "2026-02-01", netNok: 700 }]);
    expect(result.inflowOutflow).toEqual([
      { date: "2026-02-01", inflowNok: 1000, outflowNok: 300 },
    ]);
    expect(result.categoryBreakdown).toEqual([
      {
        categoryId: "cat-food",
        categoryName: "Food",
        spendNok: 200,
        transactionCount: 1,
      },
      {
        categoryId: null,
        categoryName: "Uncategorized",
        spendNok: 100,
        transactionCount: 1,
      },
    ]);
  });
});

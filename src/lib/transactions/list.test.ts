import { describe, expect, it, vi } from "vitest";
import { getTransactionsPage } from "./list";

function createTransactionsDbMock(total: number) {
  return {
    transaction: {
      count: vi.fn(async () => total),
      findMany: vi.fn(async () => [
        {
          id: "tx-2",
          accountId: "acc-1",
          categoryId: "cat-1",
          category: {
            name: "Groceries",
          },
          bookingDate: new Date("2026-02-04T00:00:00.000Z"),
          amountNok: { toString: () => "-123.45" },
          currency: "NOK",
          normalizedMerchant: "shop b",
          paymentType: "CARD",
          note: "Monthly groceries",
          createdAt: new Date("2026-02-04T10:00:00.000Z"),
          updatedAt: new Date("2026-02-04T11:00:00.000Z"),
        },
      ]),
    },
  };
}

describe("getTransactionsPage", () => {
  it("queries with account filter and deterministic pagination ordering", async () => {
    const db = createTransactionsDbMock(42);

    const result = await getTransactionsPage(db, {
      accountId: "acc-1",
      page: 2,
      pageSize: 10,
    });

    expect(db.transaction.count).toHaveBeenCalledWith({
      where: {
        accountId: "acc-1",
      },
    });
    expect(db.transaction.findMany).toHaveBeenCalledWith({
      where: {
        accountId: "acc-1",
      },
      select: {
        id: true,
        accountId: true,
        categoryId: true,
        category: {
          select: {
            name: true,
          },
        },
        bookingDate: true,
        amountNok: true,
        currency: true,
        normalizedMerchant: true,
        paymentType: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ bookingDate: "desc" }, { id: "desc" }],
      skip: 10,
      take: 10,
    });
    expect(result.pagination).toEqual({
      total: 42,
      page: 2,
      pageSize: 10,
      totalPages: 5,
    });
  });

  it("maps DB records to stable API row primitives", async () => {
    const db = createTransactionsDbMock(1);

    const result = await getTransactionsPage(db, {
      page: 1,
      pageSize: 25,
    });

    expect(result.rows).toEqual([
      {
        id: "tx-2",
        accountId: "acc-1",
        categoryId: "cat-1",
        categoryName: "Groceries",
        bookingDate: "2026-02-04",
        amountNok: -123.45,
        currency: "NOK",
        normalizedMerchant: "shop b",
        paymentType: "CARD",
        note: "Monthly groceries",
        createdAt: "2026-02-04T10:00:00.000Z",
        updatedAt: "2026-02-04T11:00:00.000Z",
      },
    ]);
    expect(result.pagination.totalPages).toBe(1);
  });
});

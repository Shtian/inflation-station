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

function createTransactionListFilters() {
  return {
    page: 1,
    pageSize: 25,
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

    const result = await getTransactionsPage(
      db,
      createTransactionListFilters(),
    );

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

  it("applies global query, date range, account, and category filters", async () => {
    const db = createTransactionsDbMock(3);

    await getTransactionsPage(db, {
      ...createTransactionListFilters(),
      query: "coffee",
      dateFrom: new Date("2026-01-01T00:00:00.000Z"),
      dateTo: new Date("2026-01-31T00:00:00.000Z"),
      accountId: "acc-1",
      categoryId: "cat-2",
    });

    const expectedWhere = {
      accountId: "acc-1",
      categoryId: "cat-2",
      bookingDate: {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lt: new Date("2026-02-01T00:00:00.000Z"),
      },
      OR: [
        {
          normalizedMerchant: {
            contains: "coffee",
          },
        },
        {
          note: {
            contains: "coffee",
          },
        },
        {
          category: {
            is: {
              name: {
                contains: "coffee",
              },
            },
          },
        },
      ],
    };

    expect(db.transaction.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(db.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
  });

  it("returns empty rows and zero pages when no filters match", async () => {
    const db = createTransactionsDbMock(0);
    db.transaction.findMany.mockResolvedValueOnce([]);

    const result = await getTransactionsPage(db, {
      ...createTransactionListFilters(),
      query: "no matches",
    });

    expect(result.rows).toEqual([]);
    expect(result.pagination).toEqual({
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    });
  });

  it("applies amount sorting with deterministic id ordering and stable pagination metadata", async () => {
    const db = createTransactionsDbMock(12);

    const result = await getTransactionsPage(db, {
      page: 2,
      pageSize: 5,
      sorting: {
        field: "amountNok",
        direction: "asc",
      },
    });

    expect(db.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ amountNok: "asc" }, { id: "asc" }],
        skip: 5,
        take: 5,
      }),
    );
    expect(result.pagination).toEqual({
      total: 12,
      page: 2,
      pageSize: 5,
      totalPages: 3,
    });
  });

  it("applies category sorting with deterministic id ordering", async () => {
    const db = createTransactionsDbMock(1);

    await getTransactionsPage(db, {
      ...createTransactionListFilters(),
      sorting: {
        field: "category",
        direction: "desc",
      },
    });

    expect(db.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            category: {
              name: "desc",
            },
          },
          { id: "desc" },
        ],
      }),
    );
  });

  it("applies bookingDate and normalizedMerchant sort fields", async () => {
    const db = createTransactionsDbMock(1);

    await getTransactionsPage(db, {
      ...createTransactionListFilters(),
      sorting: {
        field: "bookingDate",
        direction: "asc",
      },
    });

    expect(db.transaction.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ bookingDate: "asc" }, { id: "asc" }],
      }),
    );

    await getTransactionsPage(db, {
      ...createTransactionListFilters(),
      sorting: {
        field: "normalizedMerchant",
        direction: "desc",
      },
    });

    expect(db.transaction.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ normalizedMerchant: "desc" }, { id: "desc" }],
      }),
    );
  });
});

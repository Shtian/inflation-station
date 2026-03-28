import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET } from "./route";

const { getTransactionsPageMock, deleteTransactionsMock, prismaMock } =
  vi.hoisted(() => ({
    getTransactionsPageMock: vi.fn(),
    deleteTransactionsMock: vi.fn(),
    prismaMock: { _tag: "prisma-mock" },
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/transactions/list", () => ({
  getTransactionsPage: getTransactionsPageMock,
}));

vi.mock("@/lib/transactions/delete", () => ({
  deleteTransactions: deleteTransactionsMock,
}));

describe("GET /api/transactions", () => {
  beforeEach(() => {
    getTransactionsPageMock.mockReset();
    getTransactionsPageMock.mockResolvedValue({
      rows: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      },
    });
  });

  it("returns 400 for invalid page", async () => {
    const response = await GET(
      new Request("http://localhost/api/transactions?page=0"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_PAGE",
      message: "Expected page to be a positive integer.",
    });
    expect(getTransactionsPageMock).not.toHaveBeenCalled();
  });

  it("forwards validated page, pageSize, and account filter", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/transactions?page=2&pageSize=10&accountId=acc-1",
      ),
    );

    expect(response.status).toBe(200);
    expect(getTransactionsPageMock).toHaveBeenCalledWith(prismaMock, {
      page: 2,
      pageSize: 10,
      sorting: undefined,
      query: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      accountId: "acc-1",
      categoryId: undefined,
    });
  });

  it("uses defaults and omits empty account filter", async () => {
    const response = await GET(
      new Request("http://localhost/api/transactions?accountId=%20%20"),
    );

    expect(response.status).toBe(200);
    expect(getTransactionsPageMock).toHaveBeenCalledWith(prismaMock, {
      page: 1,
      pageSize: 25,
      sorting: undefined,
      query: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      accountId: undefined,
      categoryId: undefined,
    });
  });

  it("forwards extended table query params", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/transactions?page=3&pageSize=50&sorting=amountNok:asc&globalQuery=coffee%20shop&dateFrom=2026-01-01&dateTo=2026-01-31&accountId=acc-1&categoryId=cat-7",
      ),
    );

    expect(response.status).toBe(200);
    expect(getTransactionsPageMock).toHaveBeenCalledWith(prismaMock, {
      page: 3,
      pageSize: 50,
      sorting: {
        field: "amountNok",
        direction: "asc",
      },
      query: "coffee shop",
      dateFrom: new Date("2026-01-01T00:00:00.000Z"),
      dateTo: new Date("2026-01-31T00:00:00.000Z"),
      accountId: "acc-1",
      categoryId: "cat-7",
    });
  });

  it("returns 400 for malformed sorting", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/transactions?sorting=normalizedMerchant:asc",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_SORTING",
      message:
        "Expected sorting in <field>:<direction> format using bookingDate, amountNok, merchant, or category fields.",
    });
    expect(getTransactionsPageMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed date filters", async () => {
    const invalidDateResponse = await GET(
      new Request("http://localhost/api/transactions?dateFrom=2026/01/01"),
    );

    expect(invalidDateResponse.status).toBe(400);
    await expect(invalidDateResponse.json()).resolves.toEqual({
      error: "INVALID_DATE_FROM",
      message: "Expected dateFrom in YYYY-MM-DD format.",
    });

    const invalidRangeResponse = await GET(
      new Request(
        "http://localhost/api/transactions?dateFrom=2026-02-01&dateTo=2026-01-31",
      ),
    );

    expect(invalidRangeResponse.status).toBe(400);
    await expect(invalidRangeResponse.json()).resolves.toEqual({
      error: "INVALID_DATE_RANGE",
      message: "dateFrom must be less than or equal to dateTo.",
    });
    expect(getTransactionsPageMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/transactions", () => {
  beforeEach(() => {
    deleteTransactionsMock.mockReset();
    deleteTransactionsMock.mockResolvedValue(0);
  });

  it("returns 200 with deleted count on valid ids", async () => {
    deleteTransactionsMock.mockResolvedValue(3);

    const response = await DELETE(
      new Request("http://localhost/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["tx-1", "tx-2", "tx-3"] }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: 3 });
    expect(deleteTransactionsMock).toHaveBeenCalledWith(prismaMock, [
      "tx-1",
      "tx-2",
      "tx-3",
    ]);
  });

  it("returns 400 when ids is empty array", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [] }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_IDS",
    });
    expect(deleteTransactionsMock).not.toHaveBeenCalled();
  });

  it("returns 400 when ids is missing", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_IDS",
    });
    expect(deleteTransactionsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid body shape", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: "not-an-array" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_IDS",
    });
    expect(deleteTransactionsMock).not.toHaveBeenCalled();
  });
});

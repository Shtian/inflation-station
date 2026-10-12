import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { findManyMock, findUniqueMock, prismaMock } = vi.hoisted(() => {
  const findMany = vi.fn();
  const findUnique = vi.fn();

  return {
    findManyMock: findMany,
    findUniqueMock: findUnique,
    prismaMock: {
      transaction: { findMany },
      monthlyReview: { findUnique },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

function get(monthStart: string) {
  return GET(new Request(`http://localhost/api/monthly-review/${monthStart}`), {
    params: Promise.resolve({ monthStart }),
  });
}

describe("GET /api/monthly-review/[monthStart]", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    findUniqueMock.mockReset();
    findManyMock.mockResolvedValue([]);
    findUniqueMock.mockResolvedValue(null);
  });

  it("returns month in review facts with the persisted review state", async () => {
    findManyMock.mockImplementation(
      async ({ where }: { where: { bookingDate: { gte: Date } } }) =>
        where.bookingDate.gte.getUTCMonth() === 2
          ? [
              {
                id: "tx-salary",
                bookingDate: new Date("2026-03-01T08:00:00.000Z"),
                amountNok: 25000,
                normalizedMerchant: "EMPLOYER",
                category: { id: "cat-salary", name: "Salary", kind: "INCOME" },
              },
              {
                id: "tx-rent",
                bookingDate: new Date("2026-03-02T08:00:00.000Z"),
                amountNok: -12000,
                normalizedMerchant: "LANDLORD",
                category: { id: "cat-rent", name: "Rent", kind: "EXPENSE" },
              },
            ]
          : [],
    );
    findUniqueMock.mockResolvedValue({
      status: "FAILED",
      generatedAt: null,
      errorMessage: "provider_error",
      reviewText: null,
    });

    const response = await get("2026-03-01");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.review).toMatchObject({
      monthStart: "2026-03-01",
      cashflow: {
        incomeNok: 25000,
        spendNok: 12000,
        netNok: 13000,
        savingsRate: 0.52,
      },
      previousMonth: null,
      reviewState: "FAILED",
      generatedAt: null,
      errorMessage: "provider_error",
      reviewText: null,
    });
  });

  it("returns 400 for an invalid month", async () => {
    const response = await get("2026-03-15");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_MONTH_START",
      message: "Expected monthStart to match YYYY-MM-01.",
    });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("maps server errors to stable API shape", async () => {
    findManyMock.mockRejectedValue(new Error("boom"));

    const response = await get("2026-03-01");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "MONTH_IN_REVIEW_FETCH_FAILED",
      message: "Could not load month in review data.",
    });
  });
});

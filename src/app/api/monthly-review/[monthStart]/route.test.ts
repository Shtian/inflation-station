import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { findManyMock, findFirstMock, findUniqueMock, prismaMock } = vi.hoisted(
  () => {
    const findMany = vi.fn();
    const findFirst = vi.fn();
    const findUnique = vi.fn();

    return {
      findManyMock: findMany,
      findFirstMock: findFirst,
      findUniqueMock: findUnique,
      prismaMock: {
        transaction: { findMany, findFirst },
        monthlyReview: { findUnique },
      },
    };
  },
);

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
    findFirstMock.mockReset();
    findUniqueMock.mockReset();
    findManyMock.mockResolvedValue([]);
    findFirstMock.mockResolvedValue(null);
    findUniqueMock.mockResolvedValue(null);
  });

  it("returns month in review facts with the persisted review state", async () => {
    findManyMock.mockImplementation(
      async ({ where }: { where: { bookingDate: { gte: Date } } }) =>
        where.bookingDate.gte.getMonth() === 2
          ? [
              {
                id: "tx-salary",
                bookingDate: new Date("2026-03-01T08:00:00.000Z"),
                amountNok: 25000,
                normalizedMerchant: "EMPLOYER",
                paymentType: "TRANSFER",
                category: { id: "cat-salary", name: "Salary", kind: "INCOME" },
              },
              {
                id: "tx-rent",
                bookingDate: new Date("2026-03-02T08:00:00.000Z"),
                amountNok: -12000,
                normalizedMerchant: "LANDLORD",
                paymentType: "EFT",
                category: { id: "cat-rent", name: "Rent", kind: "EXPENSE" },
              },
            ]
          : [],
    );
    findFirstMock.mockImplementation(
      async ({ orderBy }: { orderBy: { bookingDate: "asc" | "desc" } }) =>
        orderBy.bookingDate === "desc"
          ? { bookingDate: new Date(2026, 0, 20) }
          : null,
    );
    findUniqueMock.mockResolvedValue({
      status: "FAILED",
      generatedAt: null,
      errorMessage: "provider_error",
      recap: null,
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
      bills: {
        totalNok: 12000,
        count: 1,
        items: [
          { merchant: "LANDLORD", categoryName: "Rent", amountNok: 12000 },
        ],
      },
      everyday: { totalNok: 0, count: 0, topMerchants: [] },
      adjacentMonths: { previous: "2026-01-01", next: null },
      reviewState: "FAILED",
      generatedAt: null,
      errorMessage: "provider_error",
      recap: null,
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

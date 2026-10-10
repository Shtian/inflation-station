import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { findUniqueMock, groupByMock, prismaMock } = vi.hoisted(() => {
  const findUnique = vi.fn();
  const groupBy = vi.fn();

  return {
    findUniqueMock: findUnique,
    groupByMock: groupBy,
    prismaMock: {
      category: { findUnique },
      transaction: { groupBy },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

function get(categoryId: string) {
  return GET(
    new Request(`http://localhost/api/categories/${categoryId}/merchants`),
    { params: Promise.resolve({ categoryId }) },
  );
}

describe("GET /api/categories/[categoryId]/merchants", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    groupByMock.mockReset();
  });

  it("returns the category's merchant history", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: "cat-1" });
    groupByMock.mockResolvedValueOnce([
      {
        normalizedMerchant: "kiwi 0445 stovner",
        merchant: "KIWI 0445 STOVNER",
        _count: { _all: 3 },
      },
      {
        normalizedMerchant: "rema 1000 oslo",
        merchant: "REMA 1000 OSLO",
        _count: { _all: 1 },
      },
    ]);

    const response = await get("cat-1");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      history: {
        transactionCount: 4,
        merchants: [
          { key: "kiwi", label: "Kiwi", transactionCount: 3 },
          { key: "rema", label: "Rema", transactionCount: 1 },
        ],
      },
    });
  });

  it("returns 404 when the category is missing", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const response = await get("cat-missing");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "CATEGORY_NOT_FOUND",
    });
  });
});

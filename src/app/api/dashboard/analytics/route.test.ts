import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getDashboardAnalyticsMock, prismaMock } = vi.hoisted(() => ({
  getDashboardAnalyticsMock: vi.fn(),
  prismaMock: { _tag: "prisma-mock" },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/dashboard/analytics", () => ({
  getDashboardAnalytics: getDashboardAnalyticsMock,
}));

describe("GET /api/dashboard/analytics", () => {
  beforeEach(() => {
    getDashboardAnalyticsMock.mockReset();
    getDashboardAnalyticsMock.mockResolvedValue({ totals: [] });
  });

  it("forwards validated date filters", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/dashboard/analytics?accountId=acc-1&startDate=2026-01-01&endDate=2026-01-31",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ totals: [] });
    expect(getDashboardAnalyticsMock).toHaveBeenCalledWith(prismaMock, {
      accountId: "acc-1",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-31T00:00:00.000Z"),
    });
  });

  it("returns 400 for date filters naming a day that does not exist", async () => {
    const invalidStartResponse = await GET(
      new Request(
        "http://localhost/api/dashboard/analytics?startDate=2026-02-31",
      ),
    );

    expect(invalidStartResponse.status).toBe(400);
    await expect(invalidStartResponse.json()).resolves.toEqual({
      error: "INVALID_START_DATE",
      message: "Expected startDate in YYYY-MM-DD format.",
    });

    const invalidEndResponse = await GET(
      new Request(
        "http://localhost/api/dashboard/analytics?endDate=2026-04-31",
      ),
    );

    expect(invalidEndResponse.status).toBe(400);
    await expect(invalidEndResponse.json()).resolves.toEqual({
      error: "INVALID_END_DATE",
      message: "Expected endDate in YYYY-MM-DD format.",
    });

    expect(getDashboardAnalyticsMock).not.toHaveBeenCalled();
  });
});

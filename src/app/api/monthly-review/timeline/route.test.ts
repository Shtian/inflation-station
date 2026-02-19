import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getMonthlyTimelineMock, prismaMock } = vi.hoisted(() => ({
  getMonthlyTimelineMock: vi.fn(),
  prismaMock: { _tag: "prisma-mock" },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/monthly-review/timeline", () => ({
  getMonthlyTimeline: getMonthlyTimelineMock,
}));

describe("GET /api/monthly-review/timeline", () => {
  beforeEach(() => {
    getMonthlyTimelineMock.mockReset();
    getMonthlyTimelineMock.mockResolvedValue([]);
  });

  it("returns 400 for invalid limit query", async () => {
    const response = await GET(
      new Request("http://localhost/api/monthly-review/timeline?limit=abc"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_TIMELINE_LIMIT",
      message: "Expected limit to be a positive integer.",
    });
    expect(getMonthlyTimelineMock).not.toHaveBeenCalled();
  });

  it("forwards validated limit to monthly timeline service", async () => {
    const response = await GET(
      new Request("http://localhost/api/monthly-review/timeline?limit=10"),
    );

    expect(response.status).toBe(200);
    expect(getMonthlyTimelineMock).toHaveBeenCalledWith(prismaMock, {
      limit: 10,
    });
    await expect(response.json()).resolves.toEqual({ rows: [] });
  });

  it("maps server errors to stable API shape", async () => {
    getMonthlyTimelineMock.mockRejectedValue(new Error("boom"));

    const response = await GET(
      new Request("http://localhost/api/monthly-review/timeline"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "MONTHLY_REVIEW_TIMELINE_FETCH_FAILED",
      message: "Could not load monthly review timeline data.",
    });
  });
});

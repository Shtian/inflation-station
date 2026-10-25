import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { routeHandler } from "./-route-handler";
import { Route } from "./health";

const GET = routeHandler(Route, "GET");

const { queryRawMock, prismaMock } = vi.hoisted(() => {
  const queryRaw = vi.fn();

  return {
    queryRawMock: queryRaw,
    prismaMock: {
      $queryRaw: queryRaw,
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it("reports ok when the database answers", async () => {
    queryRawMock.mockResolvedValueOnce([{ "1": 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("reports an error without leaking details when the query fails", async () => {
    queryRawMock.mockRejectedValueOnce(
      new Error(
        "Can't reach database at postgres://admin:hunter2@db.internal:5432",
      ),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe('{"status":"error"}');
  });
});

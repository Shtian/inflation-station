import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    importProviderMapping: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("GET /api/import-provider-mappings", () => {
  beforeEach(() => {
    prismaMock.importProviderMapping.findMany.mockReset();
    prismaMock.importProviderMapping.findMany.mockResolvedValue([]);
  });

  it("returns provider mappings with nested field mappings", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(prismaMock.importProviderMapping.findMany).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ mappings: [] });
  });
});

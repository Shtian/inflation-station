import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { routeHandler } from "../../-route-handler";
import { stubConfig } from "../../../../../tests/support/config-env";
import { Route } from "./hint-guess";

const GET = routeHandler(Route, "GET");

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/lib/categorization/hint-guess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/categorization/hint-guess")>()),
  generateCategoryHintGuess: generateMock,
}));

function get(categoryId: string) {
  return GET(
    new Request(`http://localhost/api/categories/${categoryId}/hint-guess`),
    { categoryId },
  );
}

describe("GET /api/categories/[categoryId]/hint-guess", () => {
  beforeEach(() => {
    generateMock.mockReset();
    stubConfig({ OPENAI_API_KEY: "test-key" });
  });

  it("returns the guess without caching it", async () => {
    generateMock.mockResolvedValueOnce({
      status: "ok",
      guess: {
        description: "Groceries and food shopping",
        merchants: [{ key: "meny", label: "Meny" }],
      },
    });

    const response = await get("cat-1");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      guess: {
        description: "Groceries and food shopping",
        merchants: [{ key: "meny", label: "Meny" }],
      },
    });
    expect(generateMock).toHaveBeenCalledWith({
      db: {},
      categoryId: "cat-1",
      apiKey: "test-key",
    });
  });

  it("answers disabled without generating when the flag is off", async () => {
    stubConfig({ OPENAI_HINT_SUGGESTIONS_ENABLED: false });

    const response = await get("cat-1");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      guess: null,
      reason: "disabled",
    });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("answers key_missing without generating when there is no API key", async () => {
    stubConfig({ OPENAI_API_KEY: undefined });

    const response = await get("cat-1");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      guess: null,
      reason: "key_missing",
    });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the category is missing", async () => {
    generateMock.mockResolvedValueOnce({ status: "not_found" });

    const response = await get("cat-missing");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "CATEGORY_NOT_FOUND",
    });
  });

  it("answers the failure reason when generation fails", async () => {
    generateMock.mockResolvedValueOnce({ status: "failed", reason: "timeout" });

    const response = await get("cat-1");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      guess: null,
      reason: "timeout",
    });
  });
});

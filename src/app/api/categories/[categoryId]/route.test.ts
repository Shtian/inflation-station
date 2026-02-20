import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const { updateMock, prismaMock } = vi.hoisted(() => {
  const update = vi.fn();

  return {
    updateMock: update,
    prismaMock: {
      category: {
        update,
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("PATCH /api/categories/[categoryId]", () => {
  beforeEach(() => {
    updateMock.mockReset();
  });

  it("returns 400 when payload is invalid", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/categories/cat-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "   ",
        }),
      }),
      {
        params: Promise.resolve({ categoryId: "cat-1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_CATEGORY_PAYLOAD",
    });
  });

  it("returns 404 when category is missing", async () => {
    updateMock.mockRejectedValueOnce({ code: "P2025" });

    const response = await PATCH(
      new Request("http://localhost/api/categories/cat-missing", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Commute" }),
      }),
      {
        params: Promise.resolve({ categoryId: "cat-missing" }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "CATEGORY_NOT_FOUND",
    });
  });

  it("returns 409 when renamed name conflicts", async () => {
    updateMock.mockRejectedValueOnce({ code: "P2002" });

    const response = await PATCH(
      new Request("http://localhost/api/categories/cat-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Food" }),
      }),
      {
        params: Promise.resolve({ categoryId: "cat-1" }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "CATEGORY_NAME_MUST_BE_UNIQUE",
    });
  });

  it("renames category and returns updated record", async () => {
    updateMock.mockResolvedValueOnce({
      id: "cat-1",
      name: "Commute",
      kind: "EXPENSE",
      accountId: null,
    });

    const response = await PATCH(
      new Request("http://localhost/api/categories/cat-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "  Commute  " }),
      }),
      {
        params: Promise.resolve({ categoryId: "cat-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "cat-1" },
      data: { name: "Commute" },
    });
    await expect(response.json()).resolves.toEqual({
      category: {
        id: "cat-1",
        name: "Commute",
        kind: "EXPENSE",
        accountId: null,
      },
    });
  });
});

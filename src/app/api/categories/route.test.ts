import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { createMock, prismaMock } = vi.hoisted(() => {
  const create = vi.fn();

  return {
    createMock: create,
    prismaMock: {
      category: {
        create,
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("POST /api/categories", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("persists a classifier hint when provided", async () => {
    createMock.mockResolvedValueOnce({
      id: "cat-1",
      name: "Commute",
      kind: "EXPENSE",
      classifierHint: "Recurring transport top-ups",
    });

    const response = await POST(
      new Request("http://localhost/api/categories", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Commute",
          kind: "EXPENSE",
          classifierHint: "Recurring transport top-ups",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        name: "Commute",
        kind: "EXPENSE",
        classifierHint: "Recurring transport top-ups",
      },
    });
    await expect(response.json()).resolves.toEqual({
      category: {
        id: "cat-1",
        name: "Commute",
        kind: "EXPENSE",
        classifierHint: "Recurring transport top-ups",
      },
    });
  });

  it("stores null when classifierHint is omitted", async () => {
    createMock.mockResolvedValueOnce({
      id: "cat-1",
      name: "Commute",
      kind: "EXPENSE",
      classifierHint: null,
    });

    const response = await POST(
      new Request("http://localhost/api/categories", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Commute", kind: "EXPENSE" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      data: { name: "Commute", kind: "EXPENSE", classifierHint: null },
    });
  });

  it("normalizes a whitespace-only classifierHint to null", async () => {
    createMock.mockResolvedValueOnce({
      id: "cat-1",
      name: "Commute",
      kind: "EXPENSE",
      classifierHint: null,
    });

    const response = await POST(
      new Request("http://localhost/api/categories", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Commute",
          kind: "EXPENSE",
          classifierHint: "   ",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      data: { name: "Commute", kind: "EXPENSE", classifierHint: null },
    });
  });
});

import { describe, expect, it } from "vitest";
import { parseCleanupChunkResponse } from "./wire";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function malformedResponse(): Response {
  return new Response("not json", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function abortRejection(): Promise<Response> {
  return Promise.reject(
    Object.assign(new Error("aborted"), { name: "AbortError" }),
  );
}

function networkRejection(): Promise<Response> {
  return Promise.reject(new TypeError("Failed to fetch"));
}

describe("parseCleanupChunkResponse", () => {
  const cases: Array<{
    name: string;
    attempt: () => Promise<Response>;
    expected: unknown;
  }> = [
    {
      name: "200 ok",
      attempt: () =>
        Promise.resolve(
          jsonResponse(200, {
            index: 0,
            status: "ok",
            suggestions: [{ rowId: "row-1", cleanedMessage: "Joker Oslo" }],
          }),
        ),
      expected: {
        index: 0,
        status: "ok",
        suggestions: [{ rowId: "row-1", cleanedMessage: "Joker Oslo" }],
      },
    },
    {
      name: "200 failed",
      attempt: () =>
        Promise.resolve(
          jsonResponse(200, { index: 1, status: "failed", reason: "timeout" }),
        ),
      expected: { index: 1, status: "failed", reason: "timeout" },
    },
    {
      name: "409",
      attempt: () => Promise.resolve(jsonResponse(409, { error: "conflict" })),
      expected: { index: 2, status: "failed", reason: "provider_error" },
    },
    {
      name: "500",
      attempt: () => Promise.resolve(jsonResponse(500, { error: "boom" })),
      expected: { index: 3, status: "failed", reason: "provider_error" },
    },
    {
      name: "malformed body",
      attempt: () => Promise.resolve(malformedResponse()),
      expected: { index: 4, status: "failed", reason: "provider_error" },
    },
    {
      name: "a client-side abort",
      attempt: abortRejection,
      expected: { index: 5, status: "failed", reason: "timeout" },
    },
    {
      name: "a rejected fetch that is not an abort",
      attempt: networkRejection,
      expected: { index: 6, status: "failed", reason: "provider_error" },
    },
  ];

  it.each(cases)("maps $name", async ({ attempt, expected }) => {
    const index = (expected as { index: number }).index;
    await expect(parseCleanupChunkResponse(index, attempt())).resolves.toEqual(
      expected,
    );
  });
});

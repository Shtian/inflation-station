import { describe, expect, it, vi } from "vitest";
import { reconcileSuggestions, runCleanupChunk } from "./chunk";

function chatCompletionResponse(content: string) {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1_738_780_800,
      model: "gpt-5.4-nano",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("reconcileSuggestions", () => {
  it("drops suggestions for unknown row numbers", () => {
    const result = reconcileSuggestions(
      { suggestions: [{ rowNumber: 99, cleanedMessage: "Ignore me" }] },
      new Set([2]),
    );

    expect(result).toEqual([]);
  });

  it("drops duplicate row numbers, keeping the first", () => {
    const result = reconcileSuggestions(
      {
        suggestions: [
          { rowNumber: 2, cleanedMessage: "Joker Oslo" },
          { rowNumber: 2, cleanedMessage: "Second suggestion" },
        ],
      },
      new Set([2]),
    );

    expect(result).toEqual([{ rowNumber: 2, cleanedMessage: "Joker Oslo" }]);
  });

  it("drops blank cleaned messages", () => {
    const result = reconcileSuggestions(
      { suggestions: [{ rowNumber: 2, cleanedMessage: "   " }] },
      new Set([2]),
    );

    expect(result).toEqual([]);
  });
});

describe("runCleanupChunk", () => {
  it("returns reconciled suggestions on the happy path", async () => {
    const result = await runCleanupChunk({
      apiKey: "test-key",
      rows: [
        { rowNumber: 2, message: "joker #1234 oslo" },
        { rowNumber: 3, message: "ruter as" },
      ],
      fetchImpl: vi.fn(async () =>
        chatCompletionResponse(
          JSON.stringify({
            suggestions: [
              { rowNumber: 2, cleanedMessage: "Joker Oslo" },
              { rowNumber: 99, cleanedMessage: "Ignore me" },
            ],
          }),
        ),
      ),
    });

    expect(result).toEqual({
      status: "ok",
      suggestions: [{ rowNumber: 2, cleanedMessage: "Joker Oslo" }],
    });
  });

  it("drops a duplicate rowNumber returned by the provider", async () => {
    const result = await runCleanupChunk({
      apiKey: "test-key",
      rows: [{ rowNumber: 2, message: "joker #1234 oslo" }],
      fetchImpl: vi.fn(async () =>
        chatCompletionResponse(
          JSON.stringify({
            suggestions: [
              { rowNumber: 2, cleanedMessage: "Joker Oslo" },
              { rowNumber: 2, cleanedMessage: "Other" },
            ],
          }),
        ),
      ),
    });

    expect(result).toEqual({
      status: "ok",
      suggestions: [{ rowNumber: 2, cleanedMessage: "Joker Oslo" }],
    });
  });

  it("drops a blank cleanedMessage returned by the provider", async () => {
    const result = await runCleanupChunk({
      apiKey: "test-key",
      rows: [{ rowNumber: 2, message: "joker #1234 oslo" }],
      fetchImpl: vi.fn(async () =>
        chatCompletionResponse(
          JSON.stringify({
            suggestions: [{ rowNumber: 2, cleanedMessage: "" }],
          }),
        ),
      ),
    });

    expect(result).toEqual({ status: "ok", suggestions: [] });
  });

  it("maps a non-abort provider throw to provider_error", async () => {
    const result = await runCleanupChunk({
      apiKey: "test-key",
      rows: [{ rowNumber: 2, message: "joker #1234 oslo" }],
      fetchImpl: vi.fn(async () => {
        throw new Error("network down");
      }),
    });

    expect(result).toEqual({ status: "failed", reason: "provider_error" });
  });

  it("sends the given reasoningEffort in the request body", async () => {
    let capturedBody: { reasoning_effort?: string } | undefined;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return chatCompletionResponse(
        JSON.stringify({
          suggestions: [{ rowNumber: 2, cleanedMessage: "Joker Oslo" }],
        }),
      );
    });

    await runCleanupChunk({
      apiKey: "test-key",
      reasoningEffort: "high",
      rows: [{ rowNumber: 2, message: "joker #1234 oslo" }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(capturedBody?.reasoning_effort).toBe("high");
  });

  it("defaults reasoningEffort to low when omitted", async () => {
    let capturedBody: { reasoning_effort?: string } | undefined;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return chatCompletionResponse(
        JSON.stringify({
          suggestions: [{ rowNumber: 2, cleanedMessage: "Joker Oslo" }],
        }),
      );
    });

    await runCleanupChunk({
      apiKey: "test-key",
      rows: [{ rowNumber: 2, message: "joker #1234 oslo" }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(capturedBody?.reasoning_effort).toBe("low");
  });

  it("maps an aborted request to timeout", async () => {
    const result = await runCleanupChunk({
      apiKey: "test-key",
      timeoutMs: 1,
      rows: [{ rowNumber: 2, message: "joker #1234 oslo" }],
      fetchImpl: vi.fn(
        () =>
          new Promise<Response>((_resolve, reject) => {
            setTimeout(() => {
              reject(
                Object.assign(new Error("aborted"), { name: "AbortError" }),
              );
            }, 20);
          }),
      ),
    });

    expect(result).toEqual({ status: "failed", reason: "timeout" });
  });
});

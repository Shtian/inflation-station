import { describe, expect, it, vi } from "vitest";
import { buildOpenAiMessageCleanup } from "./openai-message-cleanup";

describe("buildOpenAiMessageCleanup", () => {
  it("returns disabled when cleanup is explicitly turned off", async () => {
    const result = await buildOpenAiMessageCleanup({
      enabled: false,
      apiKey: "test-key",
      rows: [{ rowNumber: 2, message: " grocery   store " }],
    });

    expect(result).toEqual({
      suggestions: [],
      unavailableReason: "disabled",
    });
  });

  it("returns key_missing when api key is absent", async () => {
    const result = await buildOpenAiMessageCleanup({
      apiKey: null,
      rows: [{ rowNumber: 2, message: " grocery   store " }],
    });

    expect(result).toEqual({
      suggestions: [],
      unavailableReason: "key_missing",
    });
  });

  it("returns provider_error when provider response is not ok", async () => {
    const result = await buildOpenAiMessageCleanup({
      apiKey: "test-key",
      rows: [{ rowNumber: 2, message: " grocery   store " }],
      fetchImpl: vi.fn(async () => new Response(null, { status: 500 })),
    });

    expect(result).toEqual({
      suggestions: [],
      unavailableReason: "provider_error",
    });
  });

  it("returns timeout when fetch is aborted", async () => {
    const result = await buildOpenAiMessageCleanup({
      apiKey: "test-key",
      rows: [{ rowNumber: 2, message: " grocery   store " }],
      fetchImpl: vi.fn(async () =>
        Promise.reject(
          Object.assign(new Error("aborted"), { name: "AbortError" }),
        ),
      ),
    });

    expect(result).toEqual({
      suggestions: [],
      unavailableReason: "timeout",
    });
  });

  it("returns parsed suggestions for known row numbers", async () => {
    const result = await buildOpenAiMessageCleanup({
      apiKey: "test-key",
      rows: [
        { rowNumber: 2, message: "  joker #1234 oslo " },
        { rowNumber: 3, message: "ruter as " },
      ],
      fetchImpl: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: "chatcmpl-test",
              object: "chat.completion",
              created: 1_738_780_800,
              model: "gpt-5-mini",
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: JSON.stringify({
                      suggestions: [
                        { rowNumber: 2, cleanedMessage: "Joker Oslo" },
                        { rowNumber: 99, cleanedMessage: "Ignore me" },
                      ],
                    }),
                  },
                  finish_reason: "stop",
                },
              ],
              usage: {
                prompt_tokens: 123,
                completion_tokens: 45,
                total_tokens: 168,
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    });

    expect(result).toEqual({
      suggestions: [{ rowNumber: 2, cleanedMessage: "Joker Oslo" }],
      unavailableReason: null,
    });
  });
});

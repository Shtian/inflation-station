import type { Fetch } from "@typesafe-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runJevChoice } from "./client";

function systemOneResponse(choice: string, confidence: number) {
  return new Response(
    JSON.stringify({
      model: "jev-latest",
      answers: {
        pick: {
          type: "choice",
          choice,
          confidence,
          probabilities: { [choice]: confidence },
        },
      },
      usage: { input_tokens: 10, output_tokens: 2 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function abortAware(fetchImpl: Fetch): Fetch {
  return (input, init) =>
    new Promise((resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
      fetchImpl(input, init).then(resolve, reject);
    });
}

const alternatives = {
  billing: "A billing question",
  technical: "A technical question",
  other: null,
};

describe("runJevChoice", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the chosen alternative and confidence on the happy path", async () => {
    const fetchImpl = vi.fn(async () => systemOneResponse("billing", 0.87));

    const result = await runJevChoice({
      apiKey: "test-key",
      instructions: "What is this ticket about?",
      alternatives,
      state: { message: "I was charged twice." },
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({
      status: "ok",
      choice: "billing",
      confidence: 0.87,
    });
  });

  it("maps an exhausted timeout to the timeout reason", async () => {
    const fetchImpl = abortAware(() => new Promise(() => {}));

    const result = await runJevChoice({
      apiKey: "test-key",
      instructions: "What is this ticket about?",
      alternatives,
      state: { message: "I was charged twice." },
      timeoutMs: 5,
      retry: { maxRetries: 0 },
      fetchImpl,
    });

    expect(result).toEqual({ status: "unavailable", reason: "timeout" });
  });

  it("maps a non-timeout provider failure to provider_error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await runJevChoice({
      apiKey: "test-key",
      instructions: "What is this ticket about?",
      alternatives,
      state: { message: "I was charged twice." },
      retry: { maxRetries: 0 },
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({ status: "unavailable", reason: "provider_error" });
  });

  it("maps an exhausted-retry server error to provider_error", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await runJevChoice({
      apiKey: "test-key",
      instructions: "What is this ticket about?",
      alternatives,
      state: { message: "I was charged twice." },
      retry: { maxRetries: 0 },
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({ status: "unavailable", reason: "provider_error" });
  });

  it("reports disabled without calling the provider", async () => {
    const fetchImpl = vi.fn();

    const result = await runJevChoice({
      enabled: false,
      apiKey: "test-key",
      instructions: "What is this ticket about?",
      alternatives,
      state: { message: "I was charged twice." },
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({ status: "unavailable", reason: "disabled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports key_missing without calling the provider when no key is configured", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const fetchImpl = vi.fn();

    const result = await runJevChoice({
      instructions: "What is this ticket about?",
      alternatives,
      state: { message: "I was charged twice." },
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({ status: "unavailable", reason: "key_missing" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

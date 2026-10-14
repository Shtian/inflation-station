import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

function post(body: string) {
  return POST(
    new Request("http://localhost/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
  );
}

describe("POST /api/assistant/chat", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers 503 when there is no API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", " ");

    const response = await post(JSON.stringify({ messages: [] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "ASSISTANT_UNAVAILABLE",
    });
  });

  it("answers 400 when the body is not JSON", async () => {
    const response = await post("not json");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_ASSISTANT_MESSAGES",
      message: "Forespørselen må være JSON.",
    });
  });

  it("answers 400 when messages are not UI messages", async () => {
    const response = await post(
      JSON.stringify({ messages: [{ role: "user", content: "hei" }] }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_ASSISTANT_MESSAGES",
    });
  });

  it("answers 400 when a tool call breaks its input schema", async () => {
    const response = await post(
      JSON.stringify({
        messages: [
          { id: "u1", role: "user", parts: [{ type: "text", text: "Hei" }] },
          {
            id: "a1",
            role: "assistant",
            parts: [
              {
                type: "tool-summarizeSpending",
                toolCallId: "call-1",
                state: "input-available",
                input: { from: "2026-09-01", to: "2026-09-30", groupBy: "år" },
              },
            ],
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_ASSISTANT_MESSAGES",
    });
  });
});

describe("GET /api/assistant/chat", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports the chat as available when a key is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    await expect(GET().json()).resolves.toEqual({ disabledReason: null });
  });

  it("reports key_missing when the key is blank", async () => {
    vi.stubEnv("OPENAI_API_KEY", " ");

    await expect(GET().json()).resolves.toEqual({
      disabledReason: "key_missing",
    });
  });
});

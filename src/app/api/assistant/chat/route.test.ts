import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const { saveMock, model } = vi.hoisted(() => ({
  saveMock: vi.fn(),
  model: { current: undefined as unknown },
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/lib/assistant/threads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assistant/threads")>()),
  saveAssistantThreadMessages: saveMock,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => ({ chat: () => model.current }),
}));

const QUESTION = {
  id: "u1",
  role: "user",
  parts: [{ type: "text", text: "Hva brukte jeg mest på?" }],
};

function answeringModel(answer: string) {
  return new MockLanguageModelV3({
    doStream: {
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: answer },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: {
                total: 1,
                noCache: 1,
                cacheRead: 0,
                cacheWrite: 0,
              },
              outputTokens: { total: 1, text: 1, reasoning: 0 },
            },
          },
        ],
      }),
    },
  });
}

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
    saveMock.mockReset();
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
      JSON.stringify({
        id: "thread-1",
        messages: [{ role: "user", content: "hei" }],
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_ASSISTANT_MESSAGES",
    });
  });

  it("answers 400 when a tool call breaks its input schema", async () => {
    const response = await post(
      JSON.stringify({
        id: "thread-1",
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

  it.each([
    ["missing", undefined],
    ["unsafe", "../thread"],
  ])("answers 400 when the thread id is %s", async (_label, id) => {
    const response = await post(JSON.stringify({ id, messages: [QUESTION] }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_ASSISTANT_MESSAGES",
      message: "Samtalen mangler en gyldig id.",
    });
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("saves the question before answering and the whole turn after", async () => {
    model.current = answeringModel("Mest på dagligvarer.");

    const response = await post(
      JSON.stringify({ id: "thread-1", messages: [QUESTION] }),
    );
    await response.text();

    await vi.waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2));
    expect(saveMock.mock.calls[0].slice(1)).toEqual(["thread-1", [QUESTION]]);
    expect(saveMock.mock.calls[1].slice(1)).toEqual([
      "thread-1",
      [
        QUESTION,
        {
          id: expect.any(String),
          role: "assistant",
          parts: [
            { type: "step-start" },
            {
              type: "text",
              text: "Mest på dagligvarer.",
              state: "done",
            },
          ],
        },
      ],
    ]);
  });

  it("saves the answer even when the client stops reading", async () => {
    model.current = answeringModel("Mest på dagligvarer.");

    const response = await post(
      JSON.stringify({ id: "thread-1", messages: [QUESTION] }),
    );
    await response.body?.cancel();

    await vi.waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2));
    expect(saveMock.mock.calls[1][2]).toMatchObject([
      QUESTION,
      { role: "assistant", parts: [{}, { text: "Mest på dagligvarer." }] },
    ]);
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

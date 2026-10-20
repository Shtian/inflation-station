import { APICallError, simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { selectAssistantModelIds } from "@/lib/assistant/models";
import { GET, POST } from "./route";

const { saveMock, model, responsesModelIds, listChatModelsMock } = vi.hoisted(
  () => ({
    saveMock: vi.fn(),
    model: { current: undefined as unknown },
    responsesModelIds: [] as string[],
    listChatModelsMock: vi.fn(),
  }),
);

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

function listOpenAIModels(select: typeof selectAssistantModelIds) {
  const now = new Date();
  const daysAgo = (days: number) =>
    Math.floor(now.getTime() / 1000) - days * 24 * 60 * 60;
  return Promise.resolve({
    source: "openai",
    ids: select(
      [
        { id: "gpt-6", created: daysAgo(10), shutdown_date: null },
        { id: "gpt-6-pro", created: daysAgo(10), shutdown_date: null },
        { id: "gpt-5.4", created: daysAgo(100), shutdown_date: null },
      ],
      now,
    ),
  });
}

vi.mock("@/lib/assistant/threads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assistant/threads")>()),
  saveAssistantThreadMessages: saveMock,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => ({
    responses: (modelId: string) => {
      responsesModelIds.push(modelId);
      return model.current;
    },
  }),
}));

vi.mock("@/lib/openai/chat-models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openai/chat-models")>()),
  listChatModels: listChatModelsMock,
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

describe("POST /api/assistant/chat options", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    saveMock.mockReset();
    responsesModelIds.length = 0;
    listChatModelsMock.mockImplementation(listOpenAIModels);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function openAIOptionsSent(mock: MockLanguageModelV3) {
    return mock.doStreamCalls[0]?.providerOptions?.openai;
  }

  it("answers with the chosen model and reasoning effort", async () => {
    const mock = answeringModel("Mest på dagligvarer.");
    model.current = mock;

    const response = await post(
      JSON.stringify({
        id: "thread-1",
        messages: [QUESTION],
        modelId: "gpt-5.4",
        reasoningEffort: "high",
      }),
    );
    await response.text();

    expect(responsesModelIds).toEqual(["gpt-5.4"]);
    expect(openAIOptionsSent(mock)).toEqual({
      reasoningEffort: "high",
      forceReasoning: true,
    });
  });

  it("tells the client when the model rejects the reasoning effort", async () => {
    model.current = new MockLanguageModelV3({
      doStream: async () => {
        throw new APICallError({
          message:
            "Unsupported value: 'none' is not supported with the 'o3' model.",
          url: "https://api.openai.com/v1/responses",
          requestBodyValues: {},
          statusCode: 400,
          responseBody: JSON.stringify({
            error: {
              message:
                "Unsupported value: 'none' is not supported with the 'o3' model.",
              type: "invalid_request_error",
              param: "reasoning.effort",
              code: "unsupported_value",
            },
          }),
        });
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post(
      JSON.stringify({
        id: "thread-1",
        messages: [QUESTION],
        modelId: "gpt-6-luna",
        reasoningEffort: "none",
      }),
    );

    expect(await response.text()).toContain(
      '"errorText":"UNSUPPORTED_REASONING_EFFORT"',
    );
  });

  it("answers with the default model and no reasoning when options are missing", async () => {
    const mock = answeringModel("Mest på dagligvarer.");
    model.current = mock;

    const response = await post(
      JSON.stringify({ id: "thread-1", messages: [QUESTION] }),
    );
    await response.text();

    expect(responsesModelIds).toEqual(["gpt-6-luna"]);
    expect(openAIOptionsSent(mock)).toEqual({
      reasoningEffort: "none",
      forceReasoning: true,
    });
  });

  it("accepts the default model even when OpenAI does not list it", async () => {
    const mock = answeringModel("Mest på dagligvarer.");
    model.current = mock;

    const response = await post(
      JSON.stringify({
        id: "thread-1",
        messages: [QUESTION],
        modelId: "gpt-6-luna",
        reasoningEffort: "low",
      }),
    );
    await response.text();

    expect(response.status).toBe(200);
    expect(responsesModelIds).toEqual(["gpt-6-luna"]);
  });

  it("answers 400 for an unknown reasoning effort", async () => {
    const response = await post(
      JSON.stringify({
        id: "thread-1",
        messages: [QUESTION],
        reasoningEffort: "max",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_ASSISTANT_OPTIONS",
      message: "Modellen eller tenkenivået er ikke gyldig.",
    });
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("answers 400 for a model OpenAI does not offer", async () => {
    const response = await post(
      JSON.stringify({
        id: "thread-1",
        messages: [QUESTION],
        modelId: "gpt-3.5-turbo",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_ASSISTANT_OPTIONS",
      message: "Modellen gpt-3.5-turbo er ikke tilgjengelig.",
    });
    expect(responsesModelIds).toEqual([]);
  });

  it("answers 400 for an OpenAI model the assistant leaves out", async () => {
    const response = await post(
      JSON.stringify({
        id: "thread-1",
        messages: [QUESTION],
        modelId: "gpt-6-pro",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_ASSISTANT_OPTIONS",
      message: "Modellen gpt-6-pro er ikke tilgjengelig.",
    });
  });
});

describe("GET /api/assistant/chat", () => {
  beforeEach(() => {
    listChatModelsMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("offers the assistant's OpenAI models with the default first when a key is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    listChatModelsMock.mockImplementation(listOpenAIModels);

    await expect((await GET()).json()).resolves.toEqual({
      disabledReason: null,
      availableModels: ["gpt-6-luna", "gpt-6", "gpt-5.4"],
      defaultModelId: "gpt-6-luna",
    });
  });

  it("reports key_missing and offers only the default when the key is blank", async () => {
    vi.stubEnv("OPENAI_API_KEY", " ");

    await expect((await GET()).json()).resolves.toEqual({
      disabledReason: "key_missing",
      availableModels: ["gpt-6-luna"],
      defaultModelId: "gpt-6-luna",
    });
    expect(listChatModelsMock).not.toHaveBeenCalled();
  });
});

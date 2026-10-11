import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const {
  listChatModelsMock,
  getMonthlyReviewSystemPromptSettingsMock,
  updateMonthlyReviewSystemPromptSettingsMock,
  prismaMock,
} = vi.hoisted(() => ({
  listChatModelsMock: vi.fn(),
  getMonthlyReviewSystemPromptSettingsMock: vi.fn(),
  updateMonthlyReviewSystemPromptSettingsMock: vi.fn(),
  prismaMock: { _tag: "prisma-mock" },
}));

vi.mock("@/lib/openai/chat-models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openai/chat-models")>()),
  listChatModels: listChatModelsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/monthly-review/system-prompt", () => ({
  DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL: "gpt-5.4",
  getMonthlyReviewSystemPromptSettings:
    getMonthlyReviewSystemPromptSettingsMock,
  updateMonthlyReviewSystemPromptSettings:
    updateMonthlyReviewSystemPromptSettingsMock,
}));

describe("/api/monthly-review/system-prompt", () => {
  beforeEach(() => {
    getMonthlyReviewSystemPromptSettingsMock.mockReset();
    updateMonthlyReviewSystemPromptSettingsMock.mockReset();

    listChatModelsMock.mockResolvedValue({
      source: "openai",
      ids: ["gpt-6-sol", "gpt-5-mini", "gpt-5.4"],
    });

    getMonthlyReviewSystemPromptSettingsMock.mockResolvedValue({
      storedPromptText: "Focus on recurring categories.",
      resolvedPrompt: "Focus on recurring categories.",
      isDefault: false,
      storedModelId: "gpt-5-mini",
      resolvedModelId: "gpt-5-mini",
      isDefaultModel: false,
    });

    updateMonthlyReviewSystemPromptSettingsMock.mockResolvedValue({
      storedPromptText: null,
      resolvedPrompt: "Default prompt",
      isDefault: true,
      storedModelId: "gpt-5.4",
      resolvedModelId: "gpt-5.4",
      isDefaultModel: true,
    });
  });

  it("returns current prompt settings", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(getMonthlyReviewSystemPromptSettingsMock).toHaveBeenCalledWith(
      prismaMock,
    );
    await expect(response.json()).resolves.toEqual({
      promptText: "Focus on recurring categories.",
      resolvedPrompt: "Focus on recurring categories.",
      usesDefaultPrompt: false,
      modelId: "gpt-5-mini",
      resolvedModelId: "gpt-5-mini",
      usesDefaultModel: false,
      availableModels: ["gpt-6-sol", "gpt-5-mini", "gpt-5.4"],
      availableModelsSource: "openai",
    });
  });

  it("offers the saved and default models when OpenAI models are unavailable", async () => {
    listChatModelsMock.mockResolvedValue({ source: "unavailable" });

    const response = await GET();
    const body = await response.json();

    expect(body.availableModels).toEqual(["gpt-5-mini", "gpt-5.4"]);
    expect(body.availableModelsSource).toBe("unavailable");
  });

  it("maps fetch failures to stable server error", async () => {
    getMonthlyReviewSystemPromptSettingsMock.mockRejectedValue(
      new Error("boom"),
    );

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "MONTHLY_REVIEW_SYSTEM_PROMPT_FETCH_FAILED",
      message: "Could not load monthly review system prompt.",
    });
  });

  it("returns 400 for invalid update payload", async () => {
    const response = await PUT(
      new Request("http://localhost/api/monthly-review/system-prompt", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: "Missing key",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(updateMonthlyReviewSystemPromptSettingsMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_MONTHLY_REVIEW_SYSTEM_PROMPT_PAYLOAD",
      message: "Expected promptText and optional modelId in request body.",
    });
  });

  it("updates prompt settings", async () => {
    const response = await PUT(
      new Request("http://localhost/api/monthly-review/system-prompt", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          promptText: "  ",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateMonthlyReviewSystemPromptSettingsMock).toHaveBeenCalledWith(
      prismaMock,
      {
        promptText: "  ",
        modelId: "gpt-5.4",
      },
    );
    await expect(response.json()).resolves.toEqual({
      promptText: "",
      resolvedPrompt: "Default prompt",
      usesDefaultPrompt: true,
      modelId: "gpt-5.4",
      resolvedModelId: "gpt-5.4",
      usesDefaultModel: true,
      availableModels: ["gpt-6-sol", "gpt-5-mini", "gpt-5.4"],
      availableModelsSource: "openai",
    });
  });

  it("saves any modelId when OpenAI models are unavailable", async () => {
    listChatModelsMock.mockResolvedValue({ source: "unavailable" });

    const response = await PUT(
      new Request("http://localhost/api/monthly-review/system-prompt", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          promptText: "Keep it concise.",
          modelId: "gpt-6-sol",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateMonthlyReviewSystemPromptSettingsMock).toHaveBeenCalledWith(
      prismaMock,
      {
        promptText: "Keep it concise.",
        modelId: "gpt-6-sol",
      },
    );
  });

  it("returns 400 for unsupported modelId", async () => {
    const response = await PUT(
      new Request("http://localhost/api/monthly-review/system-prompt", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          promptText: "Keep it concise.",
          modelId: "not-a-valid-model",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(updateMonthlyReviewSystemPromptSettingsMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_MONTHLY_REVIEW_MODEL_ID",
      message: "Expected modelId to be one of the available OpenAI models.",
    });
  });

  it("maps update failures to stable server error", async () => {
    updateMonthlyReviewSystemPromptSettingsMock.mockRejectedValue(
      new Error("boom"),
    );

    const response = await PUT(
      new Request("http://localhost/api/monthly-review/system-prompt", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          promptText: "Focus on subscriptions.",
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "MONTHLY_REVIEW_SYSTEM_PROMPT_UPDATE_FAILED",
      message: "Could not update monthly review system prompt.",
    });
  });
});

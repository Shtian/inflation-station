import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const {
  chatModelsMock,
  defaultChatModelMock,
  getModelByIdMock,
  getMonthlyReviewSystemPromptSettingsMock,
  updateMonthlyReviewSystemPromptSettingsMock,
  prismaMock,
} = vi.hoisted(() => ({
  chatModelsMock: [
    {
      id: "gpt-4o-mini",
      label: "GPT-4o Mini",
      description: "Balanced speed and quality for routine monthly reviews.",
      tier: "cheap",
    },
    {
      id: "gpt-5.2",
      label: "GPT-5.2",
      description: "Best default quality/cost tradeoff for monthly analysis.",
      tier: "balanced",
    },
    {
      id: "gpt-5.2-pro",
      label: "GPT-5.2 Pro",
      description:
        "Highest quality for deeper, more nuanced spending insights.",
      tier: "premium",
    },
  ],
  defaultChatModelMock: "gpt-5.2",
  getModelByIdMock: vi.fn(),
  getMonthlyReviewSystemPromptSettingsMock: vi.fn(),
  updateMonthlyReviewSystemPromptSettingsMock: vi.fn(),
  prismaMock: { _tag: "prisma-mock" },
}));

vi.mock("@/lib/monthly-review/chat-model-registry", () => ({
  CHAT_MODELS: chatModelsMock,
  DEFAULT_CHAT_MODEL: defaultChatModelMock,
  getModelById: getModelByIdMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/monthly-review/system-prompt", () => ({
  getMonthlyReviewSystemPromptSettings:
    getMonthlyReviewSystemPromptSettingsMock,
  updateMonthlyReviewSystemPromptSettings:
    updateMonthlyReviewSystemPromptSettingsMock,
}));

describe("/api/monthly-review/system-prompt", () => {
  beforeEach(() => {
    getModelByIdMock.mockReset();
    getMonthlyReviewSystemPromptSettingsMock.mockReset();
    updateMonthlyReviewSystemPromptSettingsMock.mockReset();

    getModelByIdMock.mockImplementation((id: string) => {
      return (
        chatModelsMock.find((model) => model.id === id) ??
        chatModelsMock.find((model) => model.id === defaultChatModelMock)
      );
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
      storedModelId: defaultChatModelMock,
      resolvedModelId: defaultChatModelMock,
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
      availableModels: chatModelsMock,
    });
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
        modelId: defaultChatModelMock,
      },
    );
    await expect(response.json()).resolves.toEqual({
      promptText: "",
      resolvedPrompt: "Default prompt",
      usesDefaultPrompt: true,
      modelId: defaultChatModelMock,
      resolvedModelId: defaultChatModelMock,
      usesDefaultModel: true,
      availableModels: chatModelsMock,
    });
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

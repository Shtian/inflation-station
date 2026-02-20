import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const {
  chatModelsMock,
  getModelByIdMock,
  getMessageCleanupSettingsViewMock,
  updateMessageCleanupSettingsMock,
  defaultMessageCleanupModelMock,
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
      id: "gpt-5-mini",
      label: "GPT-5 Mini",
      description: "Good quality with controlled cost for regular use.",
      tier: "balanced",
    },
    {
      id: "gpt-5.2",
      label: "GPT-5.2",
      description: "Best default quality/cost tradeoff for monthly analysis.",
      tier: "balanced",
    },
  ],
  getModelByIdMock: vi.fn(),
  getMessageCleanupSettingsViewMock: vi.fn(),
  updateMessageCleanupSettingsMock: vi.fn(),
  defaultMessageCleanupModelMock: "gpt-5-mini",
  prismaMock: { _tag: "prisma-mock" },
}));

vi.mock("@/lib/monthly-review/chat-model-registry", () => ({
  CHAT_MODELS: chatModelsMock,
  getModelById: getModelByIdMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/import/message-cleanup-settings", () => ({
  DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL: defaultMessageCleanupModelMock,
  getMessageCleanupSettingsView: getMessageCleanupSettingsViewMock,
  updateMessageCleanupSettings: updateMessageCleanupSettingsMock,
}));

describe("/api/imports/message-cleanup-settings", () => {
  beforeEach(() => {
    getModelByIdMock.mockReset();
    getMessageCleanupSettingsViewMock.mockReset();
    updateMessageCleanupSettingsMock.mockReset();

    getModelByIdMock.mockImplementation((id: string) => {
      return (
        chatModelsMock.find((model) => model.id === id) ??
        chatModelsMock.find(
          (model) => model.id === defaultMessageCleanupModelMock,
        )
      );
    });

    getMessageCleanupSettingsViewMock.mockResolvedValue({
      storedPromptText: "Keep merchant names compact.",
      resolvedPrompt: "Keep merchant names compact.",
      isDefaultPrompt: false,
      storedModelId: "gpt-5-mini",
      resolvedModelId: "gpt-5-mini",
      isDefaultModel: true,
    });

    updateMessageCleanupSettingsMock.mockResolvedValue({
      storedPromptText: null,
      resolvedPrompt:
        "You clean transaction messages. Return strict JSON with top-level suggestions only.",
      isDefaultPrompt: true,
      storedModelId: defaultMessageCleanupModelMock,
      resolvedModelId: defaultMessageCleanupModelMock,
      isDefaultModel: true,
    });
  });

  it("returns current settings", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(getMessageCleanupSettingsViewMock).toHaveBeenCalledWith(prismaMock);
    await expect(response.json()).resolves.toEqual({
      promptText: "Keep merchant names compact.",
      resolvedPrompt: "Keep merchant names compact.",
      usesDefaultPrompt: false,
      modelId: "gpt-5-mini",
      resolvedModelId: "gpt-5-mini",
      usesDefaultModel: true,
      availableModels: chatModelsMock,
    });
  });

  it("maps fetch failures to stable server error", async () => {
    getMessageCleanupSettingsViewMock.mockRejectedValue(new Error("boom"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "MESSAGE_CLEANUP_SETTINGS_FETCH_FAILED",
      message: "Could not load message cleanup settings.",
    });
  });

  it("returns 400 for invalid update payload", async () => {
    const response = await PUT(
      new Request("http://localhost/api/imports/message-cleanup-settings", {
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
    expect(updateMessageCleanupSettingsMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_MESSAGE_CLEANUP_SETTINGS_PAYLOAD",
      message: "Expected promptText and optional modelId in request body.",
    });
  });

  it("updates settings", async () => {
    const response = await PUT(
      new Request("http://localhost/api/imports/message-cleanup-settings", {
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
    expect(updateMessageCleanupSettingsMock).toHaveBeenCalledWith(prismaMock, {
      promptText: "  ",
      modelId: defaultMessageCleanupModelMock,
    });
    await expect(response.json()).resolves.toEqual({
      promptText: "",
      resolvedPrompt:
        "You clean transaction messages. Return strict JSON with top-level suggestions only.",
      usesDefaultPrompt: true,
      modelId: defaultMessageCleanupModelMock,
      resolvedModelId: defaultMessageCleanupModelMock,
      usesDefaultModel: true,
      availableModels: chatModelsMock,
    });
  });

  it("returns 400 for unsupported modelId", async () => {
    const response = await PUT(
      new Request("http://localhost/api/imports/message-cleanup-settings", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          promptText: "Trim IDs and random tokens.",
          modelId: "not-a-valid-model",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(updateMessageCleanupSettingsMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_MESSAGE_CLEANUP_MODEL_ID",
      message: "Expected modelId to be one of the available OpenAI models.",
    });
  });

  it("maps update failures to stable server error", async () => {
    updateMessageCleanupSettingsMock.mockRejectedValue(new Error("boom"));

    const response = await PUT(
      new Request("http://localhost/api/imports/message-cleanup-settings", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          promptText: "Keep merchant names concise.",
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "MESSAGE_CLEANUP_SETTINGS_UPDATE_FAILED",
      message: "Could not update message cleanup settings.",
    });
  });
});

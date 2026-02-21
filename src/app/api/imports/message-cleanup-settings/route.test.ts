import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { chatModelsMock, getMessageCleanupSettingsViewMock, prismaMock } =
  vi.hoisted(() => ({
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
    prismaMock: { _tag: "prisma-mock" },
  }));

vi.mock("@/lib/monthly-review/chat-model-registry", () => ({
  CHAT_MODELS: chatModelsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/import/message-cleanup-settings", () => ({
  getMessageCleanupSettingsView: getMessageCleanupSettingsViewMock,
}));

describe("/api/imports/message-cleanup-settings", () => {
  beforeEach(() => {
    getMessageCleanupSettingsViewMock.mockReset();

    getMessageCleanupSettingsViewMock.mockResolvedValue({
      storedPromptText: "Keep merchant names compact.",
      resolvedPrompt: "Keep merchant names compact.",
      isDefaultPrompt: false,
      storedModelId: "gpt-5-mini",
      resolvedModelId: "gpt-5-mini",
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
});

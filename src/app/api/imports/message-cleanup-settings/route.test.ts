import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const {
  listChatModelsMock,
  reasoningEffortsMock,
  getMessageCleanupSettingsViewMock,
  prismaMock,
} = vi.hoisted(() => ({
  listChatModelsMock: vi.fn(),
  reasoningEffortsMock: [
    {
      id: "low",
      label: "Low",
      description: "Default. Keeps every suggestion.",
    },
    {
      id: "medium",
      label: "Medium",
      description: "Balances thoroughness and speed.",
    },
  ],
  getMessageCleanupSettingsViewMock: vi.fn(),
  prismaMock: { _tag: "prisma-mock" },
}));

vi.mock("@/lib/openai/chat-models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openai/chat-models")>()),
  listChatModels: listChatModelsMock,
}));

vi.mock("@/lib/monthly-review/reasoning-effort-registry", () => ({
  REASONING_EFFORTS: reasoningEffortsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/import/message-cleanup-settings", () => ({
  DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL: "gpt-5.6-luna",
  getMessageCleanupSettingsView: getMessageCleanupSettingsViewMock,
}));

describe("/api/imports/message-cleanup-settings", () => {
  beforeEach(() => {
    getMessageCleanupSettingsViewMock.mockReset();
    listChatModelsMock.mockResolvedValue({
      source: "openai",
      ids: ["gpt-6-luna", "gpt-5-mini", "gpt-5.6-luna"],
    });

    getMessageCleanupSettingsViewMock.mockResolvedValue({
      storedPromptText: "Keep merchant names compact.",
      resolvedPrompt: "Keep merchant names compact.",
      isDefaultPrompt: false,
      storedModelId: "gpt-5-mini",
      resolvedModelId: "gpt-5-mini",
      isDefaultModel: true,
      storedReasoningEffort: "medium",
      resolvedReasoningEffort: "medium",
      isDefaultReasoningEffort: false,
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
      availableModels: ["gpt-6-luna", "gpt-5-mini", "gpt-5.6-luna"],
      availableModelsSource: "openai",
      reasoningEffort: "medium",
      resolvedReasoningEffort: "medium",
      usesDefaultReasoningEffort: false,
      availableReasoningEfforts: reasoningEffortsMock,
    });
  });

  it("offers the saved and default models when OpenAI models are unavailable", async () => {
    listChatModelsMock.mockResolvedValue({ source: "unavailable" });

    const response = await GET();
    const body = await response.json();

    expect(body.availableModels).toEqual(["gpt-5-mini", "gpt-5.6-luna"]);
    expect(body.availableModelsSource).toBe("unavailable");
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

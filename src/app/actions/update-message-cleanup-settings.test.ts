import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateMessageCleanupSettingsAction } from "./update-message-cleanup-settings";

const { updateMessageCleanupSettingsMock, revalidatePathMock } = vi.hoisted(
  () => ({
    updateMessageCleanupSettingsMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }),
);

vi.mock("@/lib/prisma", () => ({
  prisma: { _tag: "prisma-mock" },
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/import/message-cleanup-settings", () => ({
  DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL: "gpt-5.4-nano",
  DEFAULT_MESSAGE_CLEANUP_REASONING_EFFORT: "low",
  updateMessageCleanupSettings: updateMessageCleanupSettingsMock,
}));

const settingsViewResult = {
  storedPromptText: "Keep merchant names compact.",
  resolvedPrompt: "Keep merchant names compact.",
  isDefaultPrompt: false,
  storedModelId: "gpt-5.4-nano",
  resolvedModelId: "gpt-5.4-nano",
  isDefaultModel: true,
  storedReasoningEffort: "medium",
  resolvedReasoningEffort: "medium",
  isDefaultReasoningEffort: false,
};

describe("updateMessageCleanupSettingsAction", () => {
  beforeEach(() => {
    updateMessageCleanupSettingsMock.mockReset();
    revalidatePathMock.mockReset();
    updateMessageCleanupSettingsMock.mockResolvedValue(settingsViewResult);
  });

  it("returns INVALID_MESSAGE_CLEANUP_SETTINGS_PAYLOAD when the input fails shape validation", async () => {
    const result = await updateMessageCleanupSettingsAction({
      promptText: 42,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_MESSAGE_CLEANUP_SETTINGS_PAYLOAD");
    expect(updateMessageCleanupSettingsMock).not.toHaveBeenCalled();
  });

  it("returns INVALID_MESSAGE_CLEANUP_MODEL_ID without persisting when modelId is not a known model", async () => {
    const result = await updateMessageCleanupSettingsAction({
      promptText: "Keep merchant names compact.",
      modelId: "not-a-real-model",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: "INVALID_MESSAGE_CLEANUP_MODEL_ID",
      message: "Expected modelId to be one of the available OpenAI models.",
    });
    expect(updateMessageCleanupSettingsMock).not.toHaveBeenCalled();
  });

  it("returns INVALID_MESSAGE_CLEANUP_REASONING_EFFORT without persisting when reasoningEffort is not a known option", async () => {
    const result = await updateMessageCleanupSettingsAction({
      promptText: "Keep merchant names compact.",
      reasoningEffort: "not-a-real-effort",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: "INVALID_MESSAGE_CLEANUP_REASONING_EFFORT",
      message: "Expected reasoningEffort to be one of the available options.",
    });
    expect(updateMessageCleanupSettingsMock).not.toHaveBeenCalled();
  });

  it("updates settings and returns the resolved view for valid input", async () => {
    const result = await updateMessageCleanupSettingsAction({
      promptText: "Keep merchant names compact.",
      modelId: "gpt-5.4-nano",
      reasoningEffort: "medium",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(updateMessageCleanupSettingsMock).toHaveBeenCalledWith(
      { _tag: "prisma-mock" },
      {
        promptText: "Keep merchant names compact.",
        modelId: "gpt-5.4-nano",
        reasoningEffort: "medium",
      },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/import/settings/message-cleanup",
    );
    expect(result.data).toEqual({
      promptText: "Keep merchant names compact.",
      resolvedPrompt: "Keep merchant names compact.",
      usesDefaultPrompt: false,
      modelId: "gpt-5.4-nano",
      resolvedModelId: "gpt-5.4-nano",
      usesDefaultModel: true,
      availableModels: expect.any(Array),
      reasoningEffort: "medium",
      resolvedReasoningEffort: "medium",
      usesDefaultReasoningEffort: false,
      availableReasoningEfforts: expect.any(Array),
    });
  });

  it("resolves modelId and reasoningEffort to defaults when omitted", async () => {
    const result = await updateMessageCleanupSettingsAction({
      promptText: "Keep merchant names compact.",
    });

    expect(result.ok).toBe(true);
    expect(updateMessageCleanupSettingsMock).toHaveBeenCalledWith(
      { _tag: "prisma-mock" },
      {
        promptText: "Keep merchant names compact.",
        modelId: "gpt-5.4-nano",
        reasoningEffort: "low",
      },
    );
  });
});

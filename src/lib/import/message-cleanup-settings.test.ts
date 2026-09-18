import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MESSAGE_CLEANUP_SYSTEM_PROMPT,
  getMessageCleanupSettings,
  getMessageCleanupSettingsView,
  updateMessageCleanupSettings,
} from "./message-cleanup-settings";

function createMessageCleanupSettingsDbMock(promptText: string | null = null) {
  let storedPromptText = promptText;
  let storedModelId: string | null = null;
  let storedReasoningEffort: string | null = null;

  return {
    messageCleanupSettings: {
      findUnique: vi.fn(async () =>
        storedPromptText === null &&
        storedModelId === null &&
        storedReasoningEffort === null
          ? null
          : {
              promptText: storedPromptText,
              modelId: storedModelId,
              reasoningEffort: storedReasoningEffort,
            },
      ),
      upsert: vi.fn(async ({ create, update }) => {
        if (
          storedPromptText === null &&
          storedModelId === null &&
          storedReasoningEffort === null
        ) {
          storedPromptText = create.promptText;
          storedModelId = create.modelId;
          storedReasoningEffort = create.reasoningEffort;
        } else {
          storedPromptText = update.promptText;
          storedModelId = update.modelId;
          storedReasoningEffort = update.reasoningEffort;
        }

        return {
          promptText: storedPromptText,
          modelId: storedModelId,
          reasoningEffort: storedReasoningEffort,
        };
      }),
    },
  };
}

describe("message cleanup settings", () => {
  it("returns default settings when no row exists", async () => {
    const db = createMessageCleanupSettingsDbMock();

    const result = await getMessageCleanupSettings(db);

    expect(result).toEqual({
      prompt: DEFAULT_MESSAGE_CLEANUP_SYSTEM_PROMPT,
      isDefaultPrompt: true,
      modelId: "gpt-5.6-luna",
      isDefaultModel: true,
      reasoningEffort: "low",
      isDefaultReasoningEffort: true,
    });
  });

  it("returns stored prompt when prompt exists", async () => {
    const db = createMessageCleanupSettingsDbMock(
      "Keep merchant names concise.",
    );

    const result = await getMessageCleanupSettings(db);

    expect(result).toEqual({
      prompt: "Keep merchant names concise.",
      isDefaultPrompt: false,
      modelId: "gpt-5.6-luna",
      isDefaultModel: true,
      reasoningEffort: "low",
      isDefaultReasoningEffort: true,
    });
  });

  it("returns settings view with resolved defaults", async () => {
    const db = createMessageCleanupSettingsDbMock();

    const result = await getMessageCleanupSettingsView(db);

    expect(result).toEqual({
      storedPromptText: null,
      resolvedPrompt: DEFAULT_MESSAGE_CLEANUP_SYSTEM_PROMPT,
      isDefaultPrompt: true,
      storedModelId: null,
      resolvedModelId: "gpt-5.6-luna",
      isDefaultModel: true,
      storedReasoningEffort: null,
      resolvedReasoningEffort: "low",
      isDefaultReasoningEffort: true,
    });
  });

  it("stores non-empty prompt and explicit model", async () => {
    const db = createMessageCleanupSettingsDbMock();

    const result = await updateMessageCleanupSettings(db, {
      promptText: "Keep merchant names and locations only.",
      modelId: "gpt-5.4-mini",
      reasoningEffort: null,
    });

    expect(result).toEqual({
      storedPromptText: "Keep merchant names and locations only.",
      resolvedPrompt: "Keep merchant names and locations only.",
      isDefaultPrompt: false,
      storedModelId: "gpt-5.4-mini",
      resolvedModelId: "gpt-5.4-mini",
      isDefaultModel: false,
      storedReasoningEffort: null,
      resolvedReasoningEffort: "low",
      isDefaultReasoningEffort: true,
    });
    expect(db.messageCleanupSettings.upsert).toHaveBeenCalledWith({
      where: { id: "message-cleanup-settings" },
      create: {
        id: "message-cleanup-settings",
        promptText: "Keep merchant names and locations only.",
        modelId: "gpt-5.4-mini",
        reasoningEffort: null,
      },
      update: {
        promptText: "Keep merchant names and locations only.",
        modelId: "gpt-5.4-mini",
        reasoningEffort: null,
      },
      select: { promptText: true, modelId: true, reasoningEffort: true },
    });
  });

  it("stores empty prompt as null while keeping default model", async () => {
    const db = createMessageCleanupSettingsDbMock();

    const result = await updateMessageCleanupSettings(db, {
      promptText: "   ",
      modelId: "gpt-5.6-luna",
      reasoningEffort: null,
    });

    expect(result).toEqual({
      storedPromptText: null,
      resolvedPrompt: DEFAULT_MESSAGE_CLEANUP_SYSTEM_PROMPT,
      isDefaultPrompt: true,
      storedModelId: "gpt-5.6-luna",
      resolvedModelId: "gpt-5.6-luna",
      isDefaultModel: true,
      storedReasoningEffort: null,
      resolvedReasoningEffort: "low",
      isDefaultReasoningEffort: true,
    });
  });

  it("stores explicit non-default reasoning effort", async () => {
    const db = createMessageCleanupSettingsDbMock();

    const result = await updateMessageCleanupSettings(db, {
      promptText: "Keep merchant names and locations only.",
      modelId: "gpt-5.6-luna",
      reasoningEffort: "high",
    });

    expect(result).toEqual({
      storedPromptText: "Keep merchant names and locations only.",
      resolvedPrompt: "Keep merchant names and locations only.",
      isDefaultPrompt: false,
      storedModelId: "gpt-5.6-luna",
      resolvedModelId: "gpt-5.6-luna",
      isDefaultModel: true,
      storedReasoningEffort: "high",
      resolvedReasoningEffort: "high",
      isDefaultReasoningEffort: false,
    });
    expect(db.messageCleanupSettings.upsert).toHaveBeenCalledWith({
      where: { id: "message-cleanup-settings" },
      create: {
        id: "message-cleanup-settings",
        promptText: "Keep merchant names and locations only.",
        modelId: "gpt-5.6-luna",
        reasoningEffort: "high",
      },
      update: {
        promptText: "Keep merchant names and locations only.",
        modelId: "gpt-5.6-luna",
        reasoningEffort: "high",
      },
      select: { promptText: true, modelId: true, reasoningEffort: true },
    });
  });
});

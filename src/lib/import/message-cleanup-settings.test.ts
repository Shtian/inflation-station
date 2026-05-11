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

  return {
    messageCleanupSettings: {
      findUnique: vi.fn(async () =>
        storedPromptText === null && storedModelId === null
          ? null
          : { promptText: storedPromptText, modelId: storedModelId },
      ),
      upsert: vi.fn(async ({ create, update }) => {
        if (storedPromptText === null && storedModelId === null) {
          storedPromptText = create.promptText;
          storedModelId = create.modelId;
        } else {
          storedPromptText = update.promptText;
          storedModelId = update.modelId;
        }

        return { promptText: storedPromptText, modelId: storedModelId };
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
      modelId: "gpt-5.4-mini",
      isDefaultModel: true,
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
      modelId: "gpt-5.4-mini",
      isDefaultModel: true,
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
      resolvedModelId: "gpt-5.4-mini",
      isDefaultModel: true,
    });
  });

  it("stores non-empty prompt and explicit model", async () => {
    const db = createMessageCleanupSettingsDbMock();

    const result = await updateMessageCleanupSettings(db, {
      promptText: "Keep merchant names and locations only.",
      modelId: "gpt-5.2",
    });

    expect(result).toEqual({
      storedPromptText: "Keep merchant names and locations only.",
      resolvedPrompt: "Keep merchant names and locations only.",
      isDefaultPrompt: false,
      storedModelId: "gpt-5.2",
      resolvedModelId: "gpt-5.2",
      isDefaultModel: false,
    });
    expect(db.messageCleanupSettings.upsert).toHaveBeenCalledWith({
      where: { id: "message-cleanup-settings" },
      create: {
        id: "message-cleanup-settings",
        promptText: "Keep merchant names and locations only.",
        modelId: "gpt-5.2",
      },
      update: {
        promptText: "Keep merchant names and locations only.",
        modelId: "gpt-5.2",
      },
      select: { promptText: true, modelId: true },
    });
  });

  it("stores empty prompt as null while keeping default model", async () => {
    const db = createMessageCleanupSettingsDbMock();

    const result = await updateMessageCleanupSettings(db, {
      promptText: "   ",
      modelId: "gpt-5.4-mini",
    });

    expect(result).toEqual({
      storedPromptText: null,
      resolvedPrompt: DEFAULT_MESSAGE_CLEANUP_SYSTEM_PROMPT,
      isDefaultPrompt: true,
      storedModelId: "gpt-5.4-mini",
      resolvedModelId: "gpt-5.4-mini",
      isDefaultModel: true,
    });
  });
});

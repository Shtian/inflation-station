import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { getModelById } from "../monthly-review/chat-model-registry";

const MESSAGE_CLEANUP_SETTINGS_ID = "message-cleanup-settings";

export const DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL: OpenAIChatModelId =
  "gpt-5-mini";

export const DEFAULT_MESSAGE_CLEANUP_SYSTEM_PROMPT =
  "You clean transaction messages. Return strict JSON with top-level suggestions only.";

type MessageCleanupSettingsRecord = {
  promptText: string | null;
  modelId: string | null;
};

type MessageCleanupSettingsReadDbClient = {
  messageCleanupSettings: {
    findUnique(args: {
      where: {
        id: string;
      };
      select: {
        promptText: true;
        modelId: true;
      };
    }): Promise<MessageCleanupSettingsRecord | null>;
  };
};

type MessageCleanupSettingsWriteDbClient = {
  messageCleanupSettings: {
    upsert(args: {
      where: {
        id: string;
      };
      create: {
        id: string;
        promptText: string | null;
        modelId: string | null;
      };
      update: {
        promptText: string | null;
        modelId: string | null;
      };
      select: {
        promptText: true;
        modelId: true;
      };
    }): Promise<MessageCleanupSettingsRecord>;
  };
};

type MessageCleanupSettingsDbClient = MessageCleanupSettingsReadDbClient &
  MessageCleanupSettingsWriteDbClient;

export type MessageCleanupSettingsResult = {
  prompt: string;
  isDefaultPrompt: boolean;
  modelId: OpenAIChatModelId;
  isDefaultModel: boolean;
};

export type MessageCleanupSettingsViewResult = {
  storedPromptText: string | null;
  resolvedPrompt: string;
  isDefaultPrompt: boolean;
  storedModelId: string | null;
  resolvedModelId: OpenAIChatModelId;
  isDefaultModel: boolean;
};

function resolvePrompt(promptText: string | null): {
  prompt: string;
  isDefaultPrompt: boolean;
} {
  if (!promptText || promptText.trim().length === 0) {
    return {
      prompt: DEFAULT_MESSAGE_CLEANUP_SYSTEM_PROMPT,
      isDefaultPrompt: true,
    };
  }

  return {
    prompt: promptText,
    isDefaultPrompt: false,
  };
}

function normalizePromptText(promptText: string): string | null {
  return promptText.trim().length === 0 ? null : promptText;
}

function resolveModel(modelId: string | null): {
  modelId: OpenAIChatModelId;
  isDefaultModel: boolean;
} {
  if (!modelId || modelId.trim().length === 0) {
    return {
      modelId: DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
      isDefaultModel: true,
    };
  }

  const resolvedModel = getModelById(modelId);

  return {
    modelId: resolvedModel.id,
    isDefaultModel: resolvedModel.id === DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
  };
}

function normalizeModelId(modelId: string | null): string | null {
  if (modelId === null) {
    return null;
  }

  return modelId.trim().length === 0 ? null : modelId;
}

function toViewResult(
  record: MessageCleanupSettingsRecord,
): MessageCleanupSettingsViewResult {
  const prompt = resolvePrompt(record.promptText);
  const model = resolveModel(record.modelId);

  return {
    storedPromptText: record.promptText,
    resolvedPrompt: prompt.prompt,
    isDefaultPrompt: prompt.isDefaultPrompt,
    storedModelId: record.modelId,
    resolvedModelId: model.modelId,
    isDefaultModel: model.isDefaultModel,
  };
}

export async function getMessageCleanupSettings(
  db: MessageCleanupSettingsReadDbClient,
): Promise<MessageCleanupSettingsResult> {
  const record = await db.messageCleanupSettings.findUnique({
    where: {
      id: MESSAGE_CLEANUP_SETTINGS_ID,
    },
    select: {
      promptText: true,
      modelId: true,
    },
  });

  const prompt = resolvePrompt(record?.promptText ?? null);
  const model = resolveModel(record?.modelId ?? null);

  return {
    prompt: prompt.prompt,
    isDefaultPrompt: prompt.isDefaultPrompt,
    modelId: model.modelId,
    isDefaultModel: model.isDefaultModel,
  };
}

export async function getMessageCleanupSettingsView(
  db: MessageCleanupSettingsReadDbClient,
): Promise<MessageCleanupSettingsViewResult> {
  const record = await db.messageCleanupSettings.findUnique({
    where: {
      id: MESSAGE_CLEANUP_SETTINGS_ID,
    },
    select: {
      promptText: true,
      modelId: true,
    },
  });

  return toViewResult({
    promptText: record?.promptText ?? null,
    modelId: record?.modelId ?? null,
  });
}

export async function updateMessageCleanupSettings(
  db: MessageCleanupSettingsDbClient,
  params: {
    promptText: string;
    modelId: OpenAIChatModelId | null;
  },
): Promise<MessageCleanupSettingsViewResult> {
  const normalizedModelId = normalizeModelId(params.modelId);
  const record = await db.messageCleanupSettings.upsert({
    where: {
      id: MESSAGE_CLEANUP_SETTINGS_ID,
    },
    create: {
      id: MESSAGE_CLEANUP_SETTINGS_ID,
      promptText: normalizePromptText(params.promptText),
      modelId: normalizedModelId,
    },
    update: {
      promptText: normalizePromptText(params.promptText),
      modelId: normalizedModelId,
    },
    select: {
      promptText: true,
      modelId: true,
    },
  });

  return toViewResult(record);
}

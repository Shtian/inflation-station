import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { DEFAULT_CHAT_MODEL, getModelById } from "./chat-model-registry";

const MONTHLY_REVIEW_SYSTEM_PROMPT_ID = "monthly-review-system-prompt";

export const DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL = DEFAULT_CHAT_MODEL;

export const DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT = `You are a financial review assistant.
- Analyze one calendar month of transactions and summarize key spending patterns.
- Use only the provided data and computed metrics. Do not invent values.
- Highlight notable category and merchant concentration, month-over-month movement when available, and concise actionable observations.
- Keep the response to about 2-3 paragraphs. Focus on the most impactful insights for the user. Avoid generic statements.
- Respond in plain text, NOT markdown.
- Do not include a title.
- Respond in Norwegian.`;

type MonthlyReviewSystemPromptRecord = {
  promptText: string | null;
  modelId: string | null;
};

type MonthlyReviewSystemPromptReadDbClient = {
  monthlyReviewSystemPrompt: {
    findUnique(args: {
      where: {
        id: string;
      };
      select: {
        promptText: true;
        modelId: true;
      };
    }): Promise<MonthlyReviewSystemPromptRecord | null>;
  };
};

type MonthlyReviewSystemPromptWriteDbClient = {
  monthlyReviewSystemPrompt: {
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
    }): Promise<MonthlyReviewSystemPromptRecord>;
  };
};

type MonthlyReviewSystemPromptDbClient = MonthlyReviewSystemPromptReadDbClient &
  MonthlyReviewSystemPromptWriteDbClient;

export type MonthlyReviewSystemPromptResult = {
  prompt: string;
  isDefault: boolean;
  modelId: OpenAIChatModelId;
  isDefaultModel: boolean;
};

export type MonthlyReviewSystemPromptSettingsResult = {
  storedPromptText: string | null;
  resolvedPrompt: string;
  isDefault: boolean;
  storedModelId: string | null;
  resolvedModelId: OpenAIChatModelId;
  isDefaultModel: boolean;
};

function resolvePrompt(promptText: string | null): {
  prompt: string;
  isDefault: boolean;
} {
  if (!promptText || promptText.trim().length === 0) {
    return {
      prompt: DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT,
      isDefault: true,
    };
  }

  return {
    prompt: promptText,
    isDefault: false,
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
      modelId: DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL,
      isDefaultModel: true,
    };
  }

  const resolvedModel = getModelById(modelId);

  return {
    modelId: resolvedModel.id,
    isDefaultModel: resolvedModel.id === DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL,
  };
}

function normalizeModelId(modelId: string | null): string | null {
  if (modelId === null) {
    return null;
  }

  return modelId.trim().length === 0 ? null : modelId;
}

function toSettingsResult(
  record: MonthlyReviewSystemPromptRecord,
): MonthlyReviewSystemPromptSettingsResult {
  const model = resolveModel(record.modelId);
  const resolved = resolvePrompt(record.promptText);

  return {
    storedPromptText: record.promptText,
    resolvedPrompt: resolved.prompt,
    isDefault: resolved.isDefault,
    storedModelId: record.modelId,
    resolvedModelId: model.modelId,
    isDefaultModel: model.isDefaultModel,
  };
}

export async function getMonthlyReviewSystemPrompt(
  db: MonthlyReviewSystemPromptReadDbClient,
): Promise<MonthlyReviewSystemPromptResult> {
  const record = await db.monthlyReviewSystemPrompt.findUnique({
    where: {
      id: MONTHLY_REVIEW_SYSTEM_PROMPT_ID,
    },
    select: {
      promptText: true,
      modelId: true,
    },
  });

  const resolvedPrompt = resolvePrompt(record?.promptText ?? null);
  const resolvedModel = resolveModel(record?.modelId ?? null);

  return {
    prompt: resolvedPrompt.prompt,
    isDefault: resolvedPrompt.isDefault,
    modelId: resolvedModel.modelId,
    isDefaultModel: resolvedModel.isDefaultModel,
  };
}

export async function getMonthlyReviewSystemPromptSettings(
  db: MonthlyReviewSystemPromptReadDbClient,
): Promise<MonthlyReviewSystemPromptSettingsResult> {
  const record = await db.monthlyReviewSystemPrompt.findUnique({
    where: {
      id: MONTHLY_REVIEW_SYSTEM_PROMPT_ID,
    },
    select: {
      promptText: true,
      modelId: true,
    },
  });

  return toSettingsResult({
    promptText: record?.promptText ?? null,
    modelId: record?.modelId ?? null,
  });
}

export async function updateMonthlyReviewSystemPrompt(
  db: MonthlyReviewSystemPromptDbClient,
  promptText: string,
  modelId: OpenAIChatModelId | null = null,
): Promise<MonthlyReviewSystemPromptResult> {
  const normalizedModelId = normalizeModelId(modelId);
  const record = await db.monthlyReviewSystemPrompt.upsert({
    where: {
      id: MONTHLY_REVIEW_SYSTEM_PROMPT_ID,
    },
    create: {
      id: MONTHLY_REVIEW_SYSTEM_PROMPT_ID,
      promptText: normalizePromptText(promptText),
      modelId: normalizedModelId,
    },
    update: {
      promptText: normalizePromptText(promptText),
      modelId: normalizedModelId,
    },
    select: {
      promptText: true,
      modelId: true,
    },
  });

  const resolvedPrompt = resolvePrompt(record.promptText);
  const resolvedModel = resolveModel(record.modelId);

  return {
    prompt: resolvedPrompt.prompt,
    isDefault: resolvedPrompt.isDefault,
    modelId: resolvedModel.modelId,
    isDefaultModel: resolvedModel.isDefaultModel,
  };
}

export async function updateMonthlyReviewSystemPromptSettings(
  db: MonthlyReviewSystemPromptDbClient,
  params: {
    promptText: string;
    modelId: OpenAIChatModelId | null;
  },
): Promise<MonthlyReviewSystemPromptSettingsResult> {
  const normalizedModelId = normalizeModelId(params.modelId);
  const record = await db.monthlyReviewSystemPrompt.upsert({
    where: {
      id: MONTHLY_REVIEW_SYSTEM_PROMPT_ID,
    },
    create: {
      id: MONTHLY_REVIEW_SYSTEM_PROMPT_ID,
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

  return toSettingsResult(record);
}

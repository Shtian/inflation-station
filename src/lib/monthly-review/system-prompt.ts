const MONTHLY_REVIEW_SYSTEM_PROMPT_ID = "monthly-review-system-prompt";

export const DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT = `You are a financial review assistant.
Analyze one calendar month of transactions and summarize key spending patterns.
Use only the provided data and computed metrics. Do not invent values.
Highlight notable category and merchant concentration, month-over-month movement when available, and concise actionable observations.`;

type MonthlyReviewSystemPromptRecord = {
  promptText: string | null;
};

type MonthlyReviewSystemPromptReadDbClient = {
  monthlyReviewSystemPrompt: {
    findUnique(args: {
      where: {
        id: string;
      };
      select: {
        promptText: true;
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
      };
      update: {
        promptText: string | null;
      };
      select: {
        promptText: true;
      };
    }): Promise<MonthlyReviewSystemPromptRecord>;
  };
};

type MonthlyReviewSystemPromptDbClient = MonthlyReviewSystemPromptReadDbClient &
  MonthlyReviewSystemPromptWriteDbClient;

export type MonthlyReviewSystemPromptResult = {
  prompt: string;
  isDefault: boolean;
};

export type MonthlyReviewSystemPromptSettingsResult = {
  storedPromptText: string | null;
  resolvedPrompt: string;
  isDefault: boolean;
};

function resolvePrompt(
  promptText: string | null,
): MonthlyReviewSystemPromptResult {
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

function toSettingsResult(
  promptText: string | null,
): MonthlyReviewSystemPromptSettingsResult {
  const resolved = resolvePrompt(promptText);

  return {
    storedPromptText: promptText,
    resolvedPrompt: resolved.prompt,
    isDefault: resolved.isDefault,
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
    },
  });

  return resolvePrompt(record?.promptText ?? null);
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
    },
  });

  return toSettingsResult(record?.promptText ?? null);
}

export async function updateMonthlyReviewSystemPrompt(
  db: MonthlyReviewSystemPromptDbClient,
  promptText: string,
): Promise<MonthlyReviewSystemPromptResult> {
  const record = await db.monthlyReviewSystemPrompt.upsert({
    where: {
      id: MONTHLY_REVIEW_SYSTEM_PROMPT_ID,
    },
    create: {
      id: MONTHLY_REVIEW_SYSTEM_PROMPT_ID,
      promptText: normalizePromptText(promptText),
    },
    update: {
      promptText: normalizePromptText(promptText),
    },
    select: {
      promptText: true,
    },
  });

  return resolvePrompt(record.promptText);
}

export async function updateMonthlyReviewSystemPromptSettings(
  db: MonthlyReviewSystemPromptDbClient,
  promptText: string,
): Promise<MonthlyReviewSystemPromptSettingsResult> {
  const record = await db.monthlyReviewSystemPrompt.upsert({
    where: {
      id: MONTHLY_REVIEW_SYSTEM_PROMPT_ID,
    },
    create: {
      id: MONTHLY_REVIEW_SYSTEM_PROMPT_ID,
      promptText: normalizePromptText(promptText),
    },
    update: {
      promptText: normalizePromptText(promptText),
    },
    select: {
      promptText: true,
    },
  });

  return toSettingsResult(record.promptText);
}

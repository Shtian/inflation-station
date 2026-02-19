import { MonthlyReviewStatus, type PaymentType } from "@prisma/client";
import {
  buildMonthlyReviewGenerationInput,
  type MonthlyReviewGenerationInput,
} from "./generation-input";

const MONTH_START_PATTERN = /^\d{4}-\d{2}-01$/;
const DEFAULT_PROVIDER_TIMEOUT_MS = 20_000;
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export type MonthlyReviewGenerationUnavailableReason =
  | "key_missing"
  | "timeout"
  | "provider_error";

export type MonthlyReviewGenerationResult = {
  monthStart: string;
  status: MonthlyReviewStatus;
  generatedAt: string | null;
  errorMessage: string | null;
  reviewText: string | null;
  unavailableReason: MonthlyReviewGenerationUnavailableReason | null;
};

export class MonthlyReviewMonthStartValidationError extends Error {
  constructor() {
    super("MONTH_START_INVALID");
    this.name = "MonthlyReviewMonthStartValidationError";
  }
}

type MonthlyReviewRecord = {
  monthStart: Date;
  status: MonthlyReviewStatus;
  generatedAt: Date | null;
  errorMessage: string | null;
  reviewText: string | null;
};

type MonthlyReviewGenerationDbClient = {
  transaction: {
    findMany: (args: {
      where: {
        bookingDate: {
          gte: Date;
          lt: Date;
        };
      };
      select: {
        id: true;
        bookingDate: true;
        amountNok: true;
        normalizedMerchant: true;
        paymentType: true;
        category: {
          select: {
            id: true;
            name: true;
          };
        };
      };
      orderBy: [{ bookingDate: "asc" }, { id: "asc" }];
    }) => Promise<
      Array<{
        id: string;
        bookingDate: Date;
        amountNok: { toString(): string } | number;
        normalizedMerchant: string;
        paymentType: PaymentType;
        category: {
          id: string;
          name: string;
        } | null;
      }>
    >;
  };
  monthlyReviewSystemPrompt: {
    findUnique: (args: {
      where: {
        id: string;
      };
      select: {
        promptText: true;
      };
    }) => Promise<{ promptText: string | null } | null>;
  };
  monthlyReview: {
    upsert: (args: {
      where: {
        monthStart: Date;
      };
      create: {
        monthStart: Date;
        status: MonthlyReviewStatus;
        generatedAt: null;
        errorMessage: null;
        reviewText: null;
      };
      update: {
        status: MonthlyReviewStatus;
        generatedAt: null;
        errorMessage: null;
        reviewText: null;
      };
    }) => Promise<unknown>;
    update: (args: {
      where: {
        monthStart: Date;
      };
      data: {
        status: MonthlyReviewStatus;
        generatedAt: Date | null;
        errorMessage: string | null;
        reviewText: string | null;
      };
      select: {
        monthStart: true;
        status: true;
        generatedAt: true;
        errorMessage: true;
        reviewText: true;
      };
    }) => Promise<MonthlyReviewRecord>;
  };
};

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type MonthlyReviewProviderPayload = {
  reviewText?: string;
};

class MonthlyReviewProviderError extends Error {
  readonly reason: MonthlyReviewGenerationUnavailableReason;

  constructor(reason: MonthlyReviewGenerationUnavailableReason) {
    super(reason);
    this.name = "MonthlyReviewProviderError";
    this.reason = reason;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}

function toMonthStartDate(monthStart: string): Date {
  if (!MONTH_START_PATTERN.test(monthStart)) {
    throw new MonthlyReviewMonthStartValidationError();
  }

  const [yearPart, monthPart] = monthStart.split("-");
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new MonthlyReviewMonthStartValidationError();
  }

  return new Date(Date.UTC(year, month - 1, 1));
}

function toMonthStartKey(monthStart: Date): string {
  const year = monthStart.getUTCFullYear();
  const month = `${monthStart.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}-01`;
}

function toResult(
  row: MonthlyReviewRecord,
  unavailableReason: MonthlyReviewGenerationUnavailableReason | null,
): MonthlyReviewGenerationResult {
  return {
    monthStart: toMonthStartKey(row.monthStart),
    status: row.status,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    errorMessage: row.errorMessage,
    reviewText: row.reviewText,
    unavailableReason,
  };
}

function parseReviewText(content: string): string {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw new MonthlyReviewProviderError("provider_error");
  }

  try {
    const parsed = JSON.parse(trimmedContent) as MonthlyReviewProviderPayload;
    const reviewText = parsed.reviewText?.trim();
    if (!reviewText) {
      throw new MonthlyReviewProviderError("provider_error");
    }

    return reviewText;
  } catch (error) {
    if (error instanceof MonthlyReviewProviderError) {
      throw error;
    }

    return trimmedContent;
  }
}

async function buildReviewText(params: {
  apiKey: string;
  input: MonthlyReviewGenerationInput;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  model?: string;
}): Promise<string> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const timeoutMs = Math.max(
    1,
    params.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
  );
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const userPrompt = JSON.stringify(
    {
      instructions: [
        "Write a concise monthly spending review in markdown.",
        "Use only the provided data and avoid inventing facts.",
        "Call out notable category, merchant, and month-over-month signals.",
        "Keep practical suggestions concrete and short.",
      ],
      monthStart: params.input.monthStart,
      metrics: params.input.metrics,
      transactions: params.input.transactions,
      outputFormat: {
        reviewText: "markdown summary",
      },
    },
    null,
    2,
  );

  try {
    const response = await fetchImpl(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: params.model ?? DEFAULT_OPENAI_MODEL,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: params.input.systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new MonthlyReviewProviderError("provider_error");
    }

    const payload = (await response.json()) as ChatCompletionsResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new MonthlyReviewProviderError("provider_error");
    }

    return parseReviewText(content);
  } catch (error) {
    if (error instanceof MonthlyReviewProviderError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new MonthlyReviewProviderError("timeout");
    }

    throw new MonthlyReviewProviderError("provider_error");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function persistFailedResult(
  db: MonthlyReviewGenerationDbClient,
  monthStart: Date,
  errorMessage: string,
  reason: MonthlyReviewGenerationUnavailableReason,
): Promise<MonthlyReviewGenerationResult> {
  const row = await db.monthlyReview.update({
    where: { monthStart },
    data: {
      status: MonthlyReviewStatus.FAILED,
      generatedAt: null,
      errorMessage,
      reviewText: null,
    },
    select: {
      monthStart: true,
      status: true,
      generatedAt: true,
      errorMessage: true,
      reviewText: true,
    },
  });

  return toResult(row, reason);
}

export async function generateMonthlyReview(
  db: MonthlyReviewGenerationDbClient,
  params: {
    monthStart: string;
  },
  options?: {
    openAiApiKey?: string | null;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    model?: string;
  },
): Promise<MonthlyReviewGenerationResult> {
  const normalizedMonthStart = params.monthStart.trim();
  const monthStartDate = toMonthStartDate(normalizedMonthStart);

  await db.monthlyReview.upsert({
    where: { monthStart: monthStartDate },
    create: {
      monthStart: monthStartDate,
      status: MonthlyReviewStatus.GENERATING,
      generatedAt: null,
      errorMessage: null,
      reviewText: null,
    },
    update: {
      status: MonthlyReviewStatus.GENERATING,
      generatedAt: null,
      errorMessage: null,
      reviewText: null,
    },
  });

  const openAiApiKey =
    options && "openAiApiKey" in options
      ? options.openAiApiKey
      : process.env.OPENAI_API_KEY;
  const apiKey = openAiApiKey?.trim();

  if (!apiKey) {
    return persistFailedResult(
      db,
      monthStartDate,
      "Monthly review generation is unavailable because OPENAI_API_KEY is missing.",
      "key_missing",
    );
  }

  const input = await buildMonthlyReviewGenerationInput(db, {
    monthStart: normalizedMonthStart,
  });

  try {
    const reviewText = await buildReviewText({
      apiKey,
      input,
      fetchImpl: options?.fetchImpl,
      timeoutMs: options?.timeoutMs,
      model: options?.model,
    });

    const generated = await db.monthlyReview.update({
      where: { monthStart: monthStartDate },
      data: {
        status: MonthlyReviewStatus.GENERATED,
        generatedAt: new Date(),
        errorMessage: null,
        reviewText,
      },
      select: {
        monthStart: true,
        status: true,
        generatedAt: true,
        errorMessage: true,
        reviewText: true,
      },
    });

    return toResult(generated, null);
  } catch (error) {
    if (
      error instanceof MonthlyReviewProviderError &&
      error.reason === "timeout"
    ) {
      return persistFailedResult(
        db,
        monthStartDate,
        "Monthly review generation timed out while waiting for provider response.",
        "timeout",
      );
    }

    return persistFailedResult(
      db,
      monthStartDate,
      "Monthly review generation failed due to provider error.",
      "provider_error",
    );
  }
}

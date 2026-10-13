import { createOpenAI } from "@ai-sdk/openai";
import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { MonthlyReviewStatus, type PaymentType } from "@prisma/client";
import { generateText } from "ai";
import {
  buildProviderErrorDetail,
  isAbortError,
} from "../openai/provider-errors";
import {
  buildMonthlyReviewGenerationInput,
  type MonthlyReviewGenerationInput,
} from "./generation-input";
import { toReviewMonthKey, toReviewMonthStartDate } from "./review-month-key";
import { DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL } from "./system-prompt";

const MONTH_START_PATTERN = /^\d{4}-\d{2}-01$/;
const DEFAULT_PROVIDER_TIMEOUT_MS = 20_000;
const DEFAULT_OPENAI_MODEL: OpenAIChatModelId =
  DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL;

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
            kind: true;
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
          kind: string;
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
        modelId: true;
      };
    }) => Promise<{ promptText: string | null; modelId: string | null } | null>;
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

type MonthlyReviewProviderPayload = {
  reviewText?: string;
};

class MonthlyReviewProviderError extends Error {
  readonly reason: MonthlyReviewGenerationUnavailableReason;
  readonly detail: string | null;

  constructor(
    reason: MonthlyReviewGenerationUnavailableReason,
    options?: {
      detail?: string;
      cause?: unknown;
    },
  ) {
    const detail = options?.detail?.trim();
    super(detail ? `${reason}: ${detail}` : reason, {
      cause: options?.cause,
    });
    this.name = "MonthlyReviewProviderError";
    this.reason = reason;
    this.detail = detail ?? null;
  }
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

  return toReviewMonthStartDate(year, month);
}

function toResult(
  row: MonthlyReviewRecord,
  unavailableReason: MonthlyReviewGenerationUnavailableReason | null,
): MonthlyReviewGenerationResult {
  return {
    monthStart: toReviewMonthKey(row.monthStart),
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
    throw new MonthlyReviewProviderError("provider_error", {
      detail: "Provider returned an empty response body.",
    });
  }

  try {
    const parsed = JSON.parse(trimmedContent) as MonthlyReviewProviderPayload;
    const reviewText = parsed.reviewText?.trim();
    if (!reviewText) {
      throw new MonthlyReviewProviderError("provider_error", {
        detail: "Provider JSON response is missing reviewText.",
      });
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
  model?: OpenAIChatModelId;
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
        "Write a short, warm month-in-review recap in plain text.",
        "Open with the net result: income in versus spend out, and whether the month ended in plus or minus.",
        "Treat facts.bills as fixed costs: state their total once and do not analyse them.",
        "Spend your words on facts.everyday: where the everyday money went, its top merchants, biggest purchase and busiest day.",
        "Mention notable movers versus last month when previousMonth is present.",
        "Close with one concrete, practical suggestion.",
        "Use only the provided facts and transactions; never invent numbers.",
      ],
      monthStart: params.input.monthStart,
      facts: params.input.facts,
      transactions: params.input.transactions,
      outputFormat: {
        reviewText: "plain-text recap",
      },
    },
    null,
    2,
  );

  try {
    const openai = createOpenAI({
      apiKey: params.apiKey,
      fetch: fetchImpl,
    });

    const result = await generateText({
      model: openai.chat(params.model ?? DEFAULT_OPENAI_MODEL),
      maxRetries: 0,
      system: params.input.systemPrompt,
      prompt: userPrompt,
      abortSignal: controller.signal,
    });

    if (!result.text) {
      throw new MonthlyReviewProviderError("provider_error", {
        detail: "Provider completed without returning text output.",
      });
    }

    return parseReviewText(result.text);
  } catch (error) {
    if (error instanceof MonthlyReviewProviderError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new MonthlyReviewProviderError("timeout", {
        detail: `Provider request exceeded timeout (${timeoutMs}ms).`,
        cause: error,
      });
    }

    const detail = buildProviderErrorDetail(error);
    console.error("Monthly review provider request failed", {
      monthStart: params.input.monthStart,
      model: params.model ?? DEFAULT_OPENAI_MODEL,
      timeoutMs,
      detail,
    });

    throw new MonthlyReviewProviderError("provider_error", {
      detail,
      cause: error,
    });
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
    model?: OpenAIChatModelId;
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
      model: options?.model ?? input.modelId,
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
    if (error instanceof MonthlyReviewProviderError) {
      console.error("Error generating monthly review", {
        monthStart: normalizedMonthStart,
        reason: error.reason,
        detail: error.detail,
      });
    } else {
      console.error(
        "Error generating monthly review for",
        normalizedMonthStart,
        error,
      );
    }
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

import { NextResponse } from "next/server";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  getModelById,
} from "@/lib/monthly-review/chat-model-registry";
import {
  getMonthlyReviewSystemPromptSettings,
  updateMonthlyReviewSystemPromptSettings,
} from "@/lib/monthly-review/system-prompt";
import { prisma } from "@/lib/prisma";

type MonthlyReviewSystemPromptPayload = {
  promptText: string;
  modelId: string | null;
};

type MonthlyReviewSystemPromptResponse = {
  promptText: string;
  resolvedPrompt: string;
  usesDefaultPrompt: boolean;
  modelId: string | null;
  resolvedModelId: string;
  usesDefaultModel: boolean;
  availableModels: Array<{
    id: string;
    label: string;
    description: string;
    tier: "cheap" | "balanced" | "premium";
  }>;
};

function toResponse(
  result: Awaited<ReturnType<typeof getMonthlyReviewSystemPromptSettings>>,
): MonthlyReviewSystemPromptResponse {
  return {
    promptText: result.storedPromptText ?? "",
    resolvedPrompt: result.resolvedPrompt,
    usesDefaultPrompt: result.isDefault,
    modelId: result.storedModelId,
    resolvedModelId: result.resolvedModelId,
    usesDefaultModel: result.isDefaultModel,
    availableModels: [...CHAT_MODELS],
  };
}

function parsePayload(
  payload: unknown,
): MonthlyReviewSystemPromptPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const parsedPayload = payload as {
    promptText?: unknown;
    modelId?: unknown;
  };

  if (typeof parsedPayload.promptText !== "string") {
    return null;
  }

  if (
    parsedPayload.modelId !== undefined &&
    parsedPayload.modelId !== null &&
    typeof parsedPayload.modelId !== "string"
  ) {
    return null;
  }

  return {
    promptText: parsedPayload.promptText,
    modelId:
      parsedPayload.modelId === undefined
        ? null
        : (parsedPayload.modelId ?? null),
  };
}

export async function GET() {
  try {
    const result = await getMonthlyReviewSystemPromptSettings(prisma);
    return NextResponse.json(toResponse(result));
  } catch (_error) {
    return NextResponse.json(
      {
        error: "MONTHLY_REVIEW_SYSTEM_PROMPT_FETCH_FAILED",
        message: "Could not load monthly review system prompt.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const payload = parsePayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json(
      {
        error: "INVALID_MONTHLY_REVIEW_SYSTEM_PROMPT_PAYLOAD",
        message: "Expected promptText and optional modelId in request body.",
      },
      { status: 400 },
    );
  }

  try {
    const resolvedModel = getModelById(payload.modelId ?? DEFAULT_CHAT_MODEL);
    if (payload.modelId !== null && resolvedModel.id !== payload.modelId) {
      return NextResponse.json(
        {
          error: "INVALID_MONTHLY_REVIEW_MODEL_ID",
          message: "Expected modelId to be one of the available OpenAI models.",
        },
        { status: 400 },
      );
    }

    const result = await updateMonthlyReviewSystemPromptSettings(prisma, {
      promptText: payload.promptText,
      modelId: resolvedModel.id,
    });

    return NextResponse.json(toResponse(result));
  } catch (_error) {
    return NextResponse.json(
      {
        error: "MONTHLY_REVIEW_SYSTEM_PROMPT_UPDATE_FAILED",
        message: "Could not update monthly review system prompt.",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import {
  DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL,
  getMonthlyReviewSystemPromptSettings,
  updateMonthlyReviewSystemPromptSettings,
} from "@/lib/monthly-review/system-prompt";
import {
  acceptsChatModel,
  type ChatModelList,
  listChatModels,
  type SelectableChatModels,
  toSelectableChatModels,
} from "@/lib/openai/chat-models";
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
  availableModels: string[];
  availableModelsSource: SelectableChatModels["availableModelsSource"];
};

function toResponse(
  result: Awaited<ReturnType<typeof getMonthlyReviewSystemPromptSettings>>,
  chatModels: ChatModelList,
): MonthlyReviewSystemPromptResponse {
  return {
    promptText: result.storedPromptText ?? "",
    resolvedPrompt: result.resolvedPrompt,
    usesDefaultPrompt: result.isDefault,
    modelId: result.storedModelId,
    resolvedModelId: result.resolvedModelId,
    usesDefaultModel: result.isDefaultModel,
    ...toSelectableChatModels(chatModels, {
      resolvedModelId: result.resolvedModelId,
      defaultModelId: DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL,
    }),
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
    const [result, chatModels] = await Promise.all([
      getMonthlyReviewSystemPromptSettings(prisma),
      listChatModels(),
    ]);
    return NextResponse.json(toResponse(result, chatModels));
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
    const chatModels = await listChatModels();
    if (
      payload.modelId !== null &&
      !acceptsChatModel(chatModels, payload.modelId)
    ) {
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
      modelId: payload.modelId ?? DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL,
    });

    return NextResponse.json(toResponse(result, chatModels));
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

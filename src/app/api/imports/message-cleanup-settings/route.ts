import { NextResponse } from "next/server";
import {
  DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
  getMessageCleanupSettingsView,
  updateMessageCleanupSettings,
} from "@/lib/import/message-cleanup-settings";
import {
  CHAT_MODELS,
  getModelById,
} from "@/lib/monthly-review/chat-model-registry";
import { prisma } from "@/lib/prisma";

type MessageCleanupSettingsPayload = {
  promptText: string;
  modelId: string | null;
};

type MessageCleanupSettingsResponse = {
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
  result: Awaited<ReturnType<typeof getMessageCleanupSettingsView>>,
): MessageCleanupSettingsResponse {
  return {
    promptText: result.storedPromptText ?? "",
    resolvedPrompt: result.resolvedPrompt,
    usesDefaultPrompt: result.isDefaultPrompt,
    modelId: result.storedModelId,
    resolvedModelId: result.resolvedModelId,
    usesDefaultModel: result.isDefaultModel,
    availableModels: [...CHAT_MODELS],
  };
}

function parsePayload(payload: unknown): MessageCleanupSettingsPayload | null {
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
    const result = await getMessageCleanupSettingsView(prisma);
    return NextResponse.json(toResponse(result));
  } catch (_error) {
    return NextResponse.json(
      {
        error: "MESSAGE_CLEANUP_SETTINGS_FETCH_FAILED",
        message: "Could not load message cleanup settings.",
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
        error: "INVALID_MESSAGE_CLEANUP_SETTINGS_PAYLOAD",
        message: "Expected promptText and optional modelId in request body.",
      },
      { status: 400 },
    );
  }

  try {
    const resolvedModel = getModelById(
      payload.modelId ?? DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
    );
    if (payload.modelId !== null && resolvedModel.id !== payload.modelId) {
      return NextResponse.json(
        {
          error: "INVALID_MESSAGE_CLEANUP_MODEL_ID",
          message: "Expected modelId to be one of the available OpenAI models.",
        },
        { status: 400 },
      );
    }

    const result = await updateMessageCleanupSettings(prisma, {
      promptText: payload.promptText,
      modelId: resolvedModel.id,
    });

    return NextResponse.json(toResponse(result));
  } catch (_error) {
    return NextResponse.json(
      {
        error: "MESSAGE_CLEANUP_SETTINGS_UPDATE_FAILED",
        message: "Could not update message cleanup settings.",
      },
      { status: 500 },
    );
  }
}

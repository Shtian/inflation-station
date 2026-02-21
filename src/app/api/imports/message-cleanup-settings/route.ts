import { NextResponse } from "next/server";
import { getMessageCleanupSettingsView } from "@/lib/import/message-cleanup-settings";
import { CHAT_MODELS } from "@/lib/monthly-review/chat-model-registry";
import { prisma } from "@/lib/prisma";

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

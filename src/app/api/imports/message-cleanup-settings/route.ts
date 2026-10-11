import { NextResponse } from "next/server";
import {
  DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
  getMessageCleanupSettingsView,
} from "@/lib/import/message-cleanup-settings";
import { REASONING_EFFORTS } from "@/lib/monthly-review/reasoning-effort-registry";
import {
  type ChatModelList,
  listChatModels,
  type SelectableChatModels,
  toSelectableChatModels,
} from "@/lib/openai/chat-models";
import { prisma } from "@/lib/prisma";

type MessageCleanupSettingsResponse = {
  promptText: string;
  resolvedPrompt: string;
  usesDefaultPrompt: boolean;
  modelId: string | null;
  resolvedModelId: string;
  usesDefaultModel: boolean;
  availableModels: string[];
  availableModelsSource: SelectableChatModels["availableModelsSource"];
  reasoningEffort: string | null;
  resolvedReasoningEffort: string;
  usesDefaultReasoningEffort: boolean;
  availableReasoningEfforts: Array<{
    id: string;
    label: string;
    description: string;
  }>;
};

function toResponse(
  result: Awaited<ReturnType<typeof getMessageCleanupSettingsView>>,
  chatModels: ChatModelList,
): MessageCleanupSettingsResponse {
  return {
    promptText: result.storedPromptText ?? "",
    resolvedPrompt: result.resolvedPrompt,
    usesDefaultPrompt: result.isDefaultPrompt,
    modelId: result.storedModelId,
    resolvedModelId: result.resolvedModelId,
    usesDefaultModel: result.isDefaultModel,
    ...toSelectableChatModels(chatModels, {
      resolvedModelId: result.resolvedModelId,
      defaultModelId: DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
    }),
    reasoningEffort: result.storedReasoningEffort,
    resolvedReasoningEffort: result.resolvedReasoningEffort,
    usesDefaultReasoningEffort: result.isDefaultReasoningEffort,
    availableReasoningEfforts: [...REASONING_EFFORTS],
  };
}

export async function GET() {
  try {
    const [result, chatModels] = await Promise.all([
      getMessageCleanupSettingsView(prisma),
      listChatModels(),
    ]);
    return NextResponse.json(toResponse(result, chatModels));
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

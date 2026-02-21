"use server";

import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
  type MessageCleanupSettingsViewResult,
  updateMessageCleanupSettings,
} from "@/lib/import/message-cleanup-settings";
import {
  CHAT_MODELS,
  getModelById,
} from "@/lib/monthly-review/chat-model-registry";
import { prisma } from "@/lib/prisma";
import {
  executeServerMutation,
  type MutationActionResult,
  mutationValidationError,
} from "@/lib/server-actions/mutation-result";

const updateMessageCleanupSettingsInputSchema = z.object({
  promptText: z.string(),
  modelId: z.string().nullable().optional(),
});

type MessageCleanupSettingsResponse = {
  promptText: string;
  resolvedPrompt: string;
  usesDefaultPrompt: boolean;
  modelId: string | null;
  resolvedModelId: OpenAIChatModelId;
  usesDefaultModel: boolean;
  availableModels: Array<{
    id: string;
    label: string;
    description: string;
    tier: "cheap" | "balanced" | "premium";
  }>;
};

type UpdateMessageCleanupSettingsErrorCode =
  | "INVALID_MESSAGE_CLEANUP_SETTINGS_PAYLOAD"
  | "INVALID_MESSAGE_CLEANUP_MODEL_ID"
  | "MESSAGE_CLEANUP_SETTINGS_UPDATE_FAILED";

function toResponse(
  result: MessageCleanupSettingsViewResult,
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

export async function updateMessageCleanupSettingsAction(
  input: unknown,
): Promise<
  MutationActionResult<
    MessageCleanupSettingsResponse,
    UpdateMessageCleanupSettingsErrorCode
  >
> {
  const parsedInput = updateMessageCleanupSettingsInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return mutationValidationError(
      "INVALID_MESSAGE_CLEANUP_SETTINGS_PAYLOAD",
      "Expected promptText and optional modelId in action input.",
      parsedInput.error,
    );
  }

  const resolvedModel = getModelById(
    parsedInput.data.modelId ?? DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
  );

  if (
    parsedInput.data.modelId !== null &&
    parsedInput.data.modelId !== undefined &&
    resolvedModel.id !== parsedInput.data.modelId
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_MESSAGE_CLEANUP_MODEL_ID",
        message: "Expected modelId to be one of the available OpenAI models.",
      },
    };
  }

  return executeServerMutation({
    execute: async () => {
      const result = await updateMessageCleanupSettings(prisma, {
        promptText: parsedInput.data.promptText,
        modelId: resolvedModel.id,
      });

      revalidatePath("/import/settings/message-cleanup");
      return toResponse(result);
    },
    fallbackError: {
      code: "MESSAGE_CLEANUP_SETTINGS_UPDATE_FAILED",
      message: "Could not update message cleanup settings.",
    },
  });
}

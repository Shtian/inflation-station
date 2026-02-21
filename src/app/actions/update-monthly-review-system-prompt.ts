"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  getModelById,
} from "@/lib/monthly-review/chat-model-registry";
import {
  type MonthlyReviewSystemPromptSettingsResult,
  updateMonthlyReviewSystemPromptSettings,
} from "@/lib/monthly-review/system-prompt";
import { prisma } from "@/lib/prisma";
import {
  executeServerMutation,
  type MutationActionResult,
  mutationValidationError,
} from "@/lib/server-actions/mutation-result";

const updateMonthlyReviewSystemPromptInputSchema = z.object({
  promptText: z.string(),
  modelId: z.string().nullable().optional(),
});

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

type UpdateMonthlyReviewSystemPromptErrorCode =
  | "INVALID_MONTHLY_REVIEW_SYSTEM_PROMPT_PAYLOAD"
  | "INVALID_MONTHLY_REVIEW_MODEL_ID"
  | "MONTHLY_REVIEW_SYSTEM_PROMPT_UPDATE_FAILED";

function toResponse(
  result: MonthlyReviewSystemPromptSettingsResult,
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

export async function updateMonthlyReviewSystemPromptAction(
  input: unknown,
): Promise<
  MutationActionResult<
    MonthlyReviewSystemPromptResponse,
    UpdateMonthlyReviewSystemPromptErrorCode
  >
> {
  const parsedInput =
    updateMonthlyReviewSystemPromptInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return mutationValidationError(
      "INVALID_MONTHLY_REVIEW_SYSTEM_PROMPT_PAYLOAD",
      "Expected promptText and optional modelId in action input.",
      parsedInput.error,
    );
  }

  const resolvedModel = getModelById(
    parsedInput.data.modelId ?? DEFAULT_CHAT_MODEL,
  );

  if (
    parsedInput.data.modelId !== null &&
    parsedInput.data.modelId !== undefined &&
    resolvedModel.id !== parsedInput.data.modelId
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_MONTHLY_REVIEW_MODEL_ID",
        message: "Expected modelId to be one of the available OpenAI models.",
      },
    };
  }

  return executeServerMutation({
    execute: async () => {
      const result = await updateMonthlyReviewSystemPromptSettings(prisma, {
        promptText: parsedInput.data.promptText,
        modelId: resolvedModel.id,
      });

      revalidatePath("/monthly-review/settings");
      return toResponse(result);
    },
    fallbackError: {
      code: "MONTHLY_REVIEW_SYSTEM_PROMPT_UPDATE_FAILED",
      message: "Could not update monthly review system prompt.",
    },
  });
}

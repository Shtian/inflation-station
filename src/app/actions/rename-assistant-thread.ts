"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assistantThreadIdSchema,
  assistantThreadTitleSchema,
  renameAssistantThread,
} from "@/lib/assistant/threads";
import { prisma } from "@/lib/prisma";
import {
  executeServerMutation,
  type MutationActionResult,
  mutationValidationError,
} from "@/lib/server-actions/mutation-result";
import { isRecordNotFound } from "@/lib/server-actions/prisma-errors";

const renameAssistantThreadInputSchema = z.object({
  id: assistantThreadIdSchema,
  title: assistantThreadTitleSchema,
});

type RenameAssistantThreadErrorCode =
  | "INVALID_ASSISTANT_THREAD_RENAME_PAYLOAD"
  | "ASSISTANT_THREAD_NOT_FOUND"
  | "ASSISTANT_THREAD_RENAME_FAILED";

export async function renameAssistantThreadAction(
  input: unknown,
): Promise<
  MutationActionResult<
    { id: string; title: string },
    RenameAssistantThreadErrorCode
  >
> {
  const parsedInput = renameAssistantThreadInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return mutationValidationError(
      "INVALID_ASSISTANT_THREAD_RENAME_PAYLOAD",
      "Navnet må ha mellom 1 og 80 tegn.",
      parsedInput.error,
    );
  }

  const { id, title } = parsedInput.data;

  return executeServerMutation({
    execute: async () => {
      await renameAssistantThread(prisma, id, title);
      revalidatePath("/assistant");
      return { id, title };
    },
    mapError: (error) =>
      isRecordNotFound(error)
        ? {
            code: "ASSISTANT_THREAD_NOT_FOUND",
            message: "Fant ikke samtalen.",
          }
        : null,
    fallbackError: {
      code: "ASSISTANT_THREAD_RENAME_FAILED",
      message: "Kunne ikke gi samtalen nytt navn.",
    },
  });
}

import { z } from "zod";
import {
  assistantThreadIdSchema,
  deleteAssistantThread,
} from "@/lib/assistant/threads";
import { prisma } from "@/lib/prisma";
import {
  executeServerMutation,
  type MutationActionResult,
  mutationValidationError,
} from "@/lib/server-actions/mutation-result";
import { isRecordNotFound } from "@/lib/server-actions/prisma-errors";

const deleteAssistantThreadInputSchema = z.object({
  id: assistantThreadIdSchema,
});

type DeleteAssistantThreadErrorCode =
  | "INVALID_ASSISTANT_THREAD_DELETE_PAYLOAD"
  | "ASSISTANT_THREAD_NOT_FOUND"
  | "ASSISTANT_THREAD_DELETE_FAILED";

export async function deleteAssistantThreadAction(
  input: unknown,
): Promise<
  MutationActionResult<{ id: string }, DeleteAssistantThreadErrorCode>
> {
  const parsedInput = deleteAssistantThreadInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return mutationValidationError(
      "INVALID_ASSISTANT_THREAD_DELETE_PAYLOAD",
      "Samtalen mangler en gyldig id.",
      parsedInput.error,
    );
  }

  const { id } = parsedInput.data;

  return executeServerMutation({
    execute: async () => {
      await deleteAssistantThread(prisma, id);
      return { id };
    },
    mapError: (error) =>
      isRecordNotFound(error)
        ? {
            code: "ASSISTANT_THREAD_NOT_FOUND",
            message: "Fant ikke samtalen.",
          }
        : null,
    fallbackError: {
      code: "ASSISTANT_THREAD_DELETE_FAILED",
      message: "Kunne ikke slette samtalen.",
    },
  });
}

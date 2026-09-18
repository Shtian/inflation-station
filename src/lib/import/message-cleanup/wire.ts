import { z } from "zod";
import { isAbortError } from "../../openai/provider-errors";
import type { ChunkFailureReason } from "./reasons";

export const cleanupChunkProviderSchema = z.object({
  suggestions: z.array(
    z.object({
      rowNumber: z.number().int(),
      cleanedMessage: z.string(),
    }),
  ),
});

export type CleanupChunkProviderPayload = z.infer<
  typeof cleanupChunkProviderSchema
>;

const cleanupChunkOkResponseSchema = z.object({
  index: z.number().int(),
  status: z.literal("ok"),
  suggestions: z.array(
    z.object({
      rowId: z.string(),
      cleanedMessage: z.string(),
    }),
  ),
});

const cleanupChunkFailedResponseSchema = z.object({
  index: z.number().int(),
  status: z.literal("failed"),
  reason: z.enum(["timeout", "provider_error"]),
});

export const cleanupChunkResponseSchema = z.union([
  cleanupChunkOkResponseSchema,
  cleanupChunkFailedResponseSchema,
]);

export type CleanupChunkResponse = z.infer<typeof cleanupChunkResponseSchema>;

function failed(
  index: number,
  reason: ChunkFailureReason,
): CleanupChunkResponse {
  return { index, status: "failed", reason };
}

/**
 * Turns one cleanup chunk fetch attempt into a `CleanupChunkResponse`,
 * folding every way it can go wrong into the two `ChunkFailureReason`
 * values: a non-200 response, an unparseable body, and a rejected fetch
 * all become `provider_error`; a client-side abort becomes `timeout`.
 */
export async function parseCleanupChunkResponse(
  index: number,
  fetchAttempt: Promise<Response>,
): Promise<CleanupChunkResponse> {
  let response: Response;
  try {
    response = await fetchAttempt;
  } catch (error) {
    return failed(index, isAbortError(error) ? "timeout" : "provider_error");
  }

  if (!response.ok) {
    return failed(index, "provider_error");
  }

  const body = await response.json().catch(() => null);
  const parsed = cleanupChunkResponseSchema.safeParse(body);

  return parsed.success ? parsed.data : failed(index, "provider_error");
}

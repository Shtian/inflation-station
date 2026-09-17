import { z } from "zod";

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

const cleanupChunkUnavailableResponseSchema = z.object({
  index: z.number().int(),
  status: z.literal("unavailable"),
  reason: z.enum(["timeout", "provider_error"]),
});

export const cleanupChunkResponseSchema = z.union([
  cleanupChunkOkResponseSchema,
  cleanupChunkUnavailableResponseSchema,
]);

export type CleanupChunkResponse = z.infer<typeof cleanupChunkResponseSchema>;

export function parseCleanupChunkResponse(
  payload: unknown,
): CleanupChunkResponse | null {
  const parsed = cleanupChunkResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

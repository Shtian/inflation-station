import type { z } from "zod";

export function formatPayloadErrorMessage(
  summary: string,
  flattened: z.ZodFlattenedError<Record<string, unknown>>,
) {
  const parts = [summary, ...flattened.formErrors];

  for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
    const first = messages?.[0];
    if (first) {
      parts.push(`${field}: ${first}`);
    }
  }

  return parts.join(" ");
}

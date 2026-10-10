import { z } from "zod";
import type { HintGuess } from "@/lib/categorization/hint-guess";

export type HintGuessUnavailableReason = "disabled" | "key_missing" | "failed";

export type HintGuessFetchResult =
  | { kind: "loaded"; guess: HintGuess }
  | { kind: "unavailable"; reason: HintGuessUnavailableReason };

const responseSchema = z.union([
  z.object({
    guess: z.object({
      description: z.string().min(1).nullable(),
      merchants: z.array(
        z.object({ key: z.string().min(1), label: z.string().min(1) }),
      ),
    }),
  }),
  z.object({
    guess: z.null(),
    reason: z.enum(["disabled", "key_missing", "timeout", "provider_error"]),
  }),
]);

const FAILED: HintGuessFetchResult = { kind: "unavailable", reason: "failed" };

export async function fetchHintGuess(
  categoryId: string,
  signal: AbortSignal,
): Promise<HintGuessFetchResult> {
  try {
    const response = await fetch(
      `/api/categories/${encodeURIComponent(categoryId)}/hint-guess`,
      { signal },
    );
    if (!response.ok) {
      return FAILED;
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return FAILED;
    }
    const body = parsed.data;
    if (body.guess !== null) {
      return { kind: "loaded", guess: body.guess };
    }
    return body.reason === "disabled" || body.reason === "key_missing"
      ? { kind: "unavailable", reason: body.reason }
      : FAILED;
  } catch {
    return FAILED;
  }
}

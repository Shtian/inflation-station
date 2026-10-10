import { z } from "zod";
import type { HintGuess } from "@/lib/categorization/hint-guess";

const responseSchema = z.object({
  guess: z
    .object({
      description: z.string().min(1).nullable(),
      merchants: z.array(
        z.object({ key: z.string().min(1), label: z.string().min(1) }),
      ),
    })
    .nullable(),
});

export async function fetchHintGuess(
  categoryId: string,
  signal: AbortSignal,
): Promise<HintGuess | null> {
  try {
    const response = await fetch(
      `/api/categories/${encodeURIComponent(categoryId)}/hint-guess`,
      { signal },
    );
    if (!response.ok) {
      return null;
    }
    const parsed = responseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.guess : null;
  } catch {
    return null;
  }
}

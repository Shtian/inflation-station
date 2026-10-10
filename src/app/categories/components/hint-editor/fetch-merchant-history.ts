import { z } from "zod";
import type { CategoryMerchantHistory } from "@/lib/categorization/category-merchants";

const responseSchema = z.object({
  history: z.object({
    transactionCount: z.number().int().nonnegative(),
    merchants: z.array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        transactionCount: z.number().int().positive(),
      }),
    ),
  }),
});

export async function fetchMerchantHistory(
  categoryId: string,
  signal: AbortSignal,
): Promise<CategoryMerchantHistory | null> {
  try {
    const response = await fetch(
      `/api/categories/${encodeURIComponent(categoryId)}/merchants`,
      { signal },
    );
    if (!response.ok) {
      return null;
    }
    const parsed = responseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.history : null;
  } catch {
    return null;
  }
}

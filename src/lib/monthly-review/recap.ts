import { z } from "zod";

// Counts live in the descriptions, not min/max: OpenAI strict JSON schema
// rejects array length constraints.
export const monthlyRecapSchema = z.object({
  headline: z
    .string()
    .describe(
      "One sentence with the month's net result: income in versus spend out, ending in plus or minus.",
    ),
  points: z
    .array(z.string())
    .describe(
      "Three to four short one-sentence points. The last point is one concrete, practical suggestion.",
    ),
});

export type MonthlyRecap = { headline: string; points: string[] };

export function toMonthlyRecap(value: unknown): MonthlyRecap | null {
  const parsed = monthlyRecapSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const headline = parsed.data.headline.trim();
  if (!headline) {
    return null;
  }

  return {
    headline,
    points: parsed.data.points
      .map((point) => point.trim())
      .filter((point) => point.length > 0),
  };
}

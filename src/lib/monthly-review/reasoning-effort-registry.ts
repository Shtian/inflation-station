import { z } from "zod";

export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

export const reasoningEffortSchema = z.custom<ReasoningEffort>(
  (value) => typeof value === "string",
);

export const reasoningEffortEntrySchema = z.object({
  id: reasoningEffortSchema,
  label: z.string(),
  description: z.string(),
});

export type ReasoningEffortEntry = z.infer<typeof reasoningEffortEntrySchema>;

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";

export const REASONING_EFFORTS: readonly ReasoningEffortEntry[] = [
  {
    id: "none",
    label: "Ingen",
    description: "Raskest, men kan stille droppe forslag på enkelte modeller.",
  },
  {
    id: "low",
    label: "Lav",
    description:
      "Standard. Beholder alle forslag, omtrent 30 % raskere enn uten overstyring.",
  },
  {
    id: "medium",
    label: "Middels",
    description: "Balanserer grundighet og fart for vanlige ryddekjøringer.",
  },
  {
    id: "high",
    label: "Høy",
    description:
      "Resonnerer grundigere før svaret, i et merkbart lavere tempo.",
  },
  {
    id: "xhigh",
    label: "Ekstra høy",
    description: "Tregest, med den grundigste resonneringen.",
  },
];

const REASONING_EFFORT_BY_ID = new Map<ReasoningEffort, ReasoningEffortEntry>(
  REASONING_EFFORTS.map((effort) => [effort.id, effort]),
);

const DEFAULT_REASONING_EFFORT_ENTRY = (() => {
  const defaultEffort = REASONING_EFFORT_BY_ID.get(DEFAULT_REASONING_EFFORT);
  if (defaultEffort) {
    return defaultEffort;
  }

  throw new Error("DEFAULT_REASONING_EFFORT_MISSING_FROM_REGISTRY");
})();

export function getReasoningEffortById(id: string): ReasoningEffortEntry {
  const effort = REASONING_EFFORT_BY_ID.get(id as ReasoningEffort);
  return effort ?? DEFAULT_REASONING_EFFORT_ENTRY;
}

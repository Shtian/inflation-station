export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

export type ReasoningEffortEntry = {
  id: ReasoningEffort;
  label: string;
  description: string;
};

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";

export const REASONING_EFFORTS: readonly ReasoningEffortEntry[] = [
  {
    id: "none",
    label: "None",
    description: "Fastest, but can silently drop suggestions on some models.",
  },
  {
    id: "low",
    label: "Low",
    description:
      "Default. Keeps every suggestion, roughly 30% faster than no override.",
  },
  {
    id: "medium",
    label: "Medium",
    description: "Balances thoroughness and speed for everyday cleanup runs.",
  },
  {
    id: "high",
    label: "High",
    description:
      "Reasons more carefully before answering, at a noticeably slower pace.",
  },
  {
    id: "xhigh",
    label: "Extra high",
    description: "Slowest, most thorough reasoning.",
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

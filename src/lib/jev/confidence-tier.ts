export type JevConfidenceTier = "low" | "medium" | "high";

export function classifyJevConfidence(confidence: number): JevConfidenceTier | null {
  if (confidence < 0.1) return null; // below floor: not a signal
  if (confidence < 0.25) return "low";
  if (confidence < 0.75) return "medium";
  return "high";
}

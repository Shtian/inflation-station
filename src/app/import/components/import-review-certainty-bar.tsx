import type { JevConfidenceTier } from "@/lib/jev/confidence-tier";
import { cn } from "@/lib/utils";

const TIER_LABEL: Record<JevConfidenceTier, string> = {
  low: "low",
  medium: "medium",
  high: "high",
};

const TIER_COLOR_CLASS: Record<JevConfidenceTier, string> = {
  high: "bg-success",
  medium: "bg-warning",
  low: "bg-destructive",
};

type ImportReviewCertaintyBarProps = {
  tier: JevConfidenceTier;
  rowNumber: number;
};

export function ImportReviewCertaintyBar({
  tier,
  rowNumber,
}: ImportReviewCertaintyBarProps) {
  return (
    <span
      role="img"
      aria-label={`AI suggestion confidence for row ${rowNumber}: ${TIER_LABEL[tier]}`}
      className={cn("h-5 w-1 shrink-0 rounded-full", TIER_COLOR_CLASS[tier])}
    />
  );
}

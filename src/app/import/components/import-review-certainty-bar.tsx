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
  confidence: number;
  rowNumber: number;
};

export function ImportReviewCertaintyBar({
  tier,
  confidence,
  rowNumber,
}: ImportReviewCertaintyBarProps) {
  return (
    <span
      role="img"
      aria-label={`AI suggestion confidence for row ${rowNumber}: ${TIER_LABEL[tier]}`}
      className="relative inline-block h-5 w-1 shrink-0 overflow-hidden rounded-full bg-border"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-full",
          TIER_COLOR_CLASS[tier],
        )}
        style={{ height: `${Math.round(confidence * 100)}%` }}
      />
    </span>
  );
}

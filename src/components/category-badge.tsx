import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { getCategoryColor } from "@/lib/category-color";
import type { DeterministicColorVariation } from "@/lib/deterministic-color";
import { cn } from "@/lib/utils";

type CategoryBadgeProps = {
  label: string;
  variation?: DeterministicColorVariation;
  className?: string;
};

export function CategoryBadge({
  label,
  variation = "muted",
  className,
}: CategoryBadgeProps) {
  const color = getCategoryColor(label, variation);
  const style = {
    "--category-badge-fg-light": color.lightTextColor,
    "--category-badge-fg-dark": color.darkTextColor,
    backgroundColor: color.backgroundColor,
    borderColor: color.borderColor,
  } as CSSProperties;

  return (
    <Badge
      variant="ghost"
      className={cn(
        "border [color:var(--category-badge-fg-light)] dark:[color:var(--category-badge-fg-dark)]",
        className,
      )}
      style={style}
    >
      {label}
    </Badge>
  );
}

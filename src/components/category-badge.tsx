import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { getCategoryColor } from "@/lib/category-color";
import { cn } from "@/lib/utils";

type CategoryBadgeProps = {
  label: string;
  className?: string;
};

export function CategoryBadge({ label, className }: CategoryBadgeProps) {
  const color = getCategoryColor(label);
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

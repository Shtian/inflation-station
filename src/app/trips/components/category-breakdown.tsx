import { CategoryBadge } from "@/components/category-badge";
import { getCategoryColor } from "@/lib/category-color";
import type { CategoryCost } from "@/lib/trips/summary";
import { formatAmount } from "../format";

export function CategoryBreakdown({ items }: { items: CategoryCost[] }) {
  const largest = Math.max(...items.map((item) => item.costNok), 0);

  return (
    <ul aria-label="Kostnad per kategori" className="max-w-2xl space-y-2.5">
      {items.map((item) => (
        <li
          key={item.categoryName}
          className="grid grid-cols-[10rem_minmax(0,1fr)_7rem] items-center gap-3"
        >
          <CategoryBadge
            label={item.categoryName}
            className="justify-self-start"
          />
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              aria-hidden
              className="h-full rounded-full"
              style={{
                width: `${largest > 0 ? Math.max((item.costNok / largest) * 100, 0) : 0}%`,
                backgroundColor: getCategoryColor(item.categoryName)
                  .borderColor,
              }}
            />
          </div>
          <span className="text-right font-mono text-sm tabular-nums">
            {formatAmount(item.costNok)}
          </span>
        </li>
      ))}
    </ul>
  );
}

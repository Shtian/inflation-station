import { getCategoryColor } from "@/lib/category-color";
import { formatNok } from "../monthly-review-manager.utils";

type CategorySpend = {
  categoryId: string | null;
  categoryName: string;
  spendNok: number;
};

export function CategorySpendBar({
  categories,
  total,
}: {
  categories: CategorySpend[];
  total: number;
}) {
  if (categories.length === 0 || total <= 0) {
    return (
      <p className="text-muted-foreground text-xs">No categorized spend.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {categories.map((category, index) => {
          const percent = (category.spendNok / total) * 100;
          const color = getCategoryColor(category.categoryName);

          return (
            <div
              key={category.categoryId ?? `${category.categoryName}-${index}`}
              className="h-full transition-all"
              style={{
                width: `${percent}%`,
                backgroundColor: color.backgroundColor,
              }}
              title={`${category.categoryName}: ${formatNok(category.spendNok)}`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {categories.map((category, index) => {
          const color = getCategoryColor(category.categoryName);

          return (
            <div
              key={category.categoryId ?? `${category.categoryName}-${index}`}
              className="flex items-center gap-1.5"
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color.backgroundColor }}
              />
              <span className="text-muted-foreground text-xs">
                {category.categoryName}
              </span>
              <span className="font-medium text-foreground text-xs">
                {formatNok(category.spendNok)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { CategoryCombobox } from "@/components/category-combobox";
import type { JevCertaintySignal } from "@/lib/jev/confidence-tier";
import { cn } from "@/lib/utils";
import { ImportReviewCertaintyBar } from "./import-review-certainty-bar";

type Category = {
  id: string;
  name: string;
};

type ImportReviewCategoryCellProps = {
  rowId: string;
  rowNumber: number;
  selectedCategoryId: string;
  categories: Category[];
  certainty: JevCertaintySignal | null;
  onCategoryChange: (rowId: string, categoryId: string) => void;
};

export function ImportReviewCategoryCell({
  rowId,
  rowNumber,
  selectedCategoryId,
  categories,
  certainty,
  onCategoryChange,
}: ImportReviewCategoryCellProps) {
  const isUncategorized = selectedCategoryId.length === 0;

  return (
    <div className="flex items-center gap-1.5">
      <CategoryCombobox
        value={selectedCategoryId}
        categories={categories}
        onValueChange={(value) => onCategoryChange(rowId, value)}
        placeholder="Uncategorized"
        emptyLabel="No matching categories."
        ariaLabel={`Category for row ${rowNumber}`}
        className={cn("w-[220px]", isUncategorized && "text-warning")}
        showClear
      />
      {certainty != null && (
        <ImportReviewCertaintyBar
          tier={certainty.tier}
          confidence={certainty.confidence}
          rowNumber={rowNumber}
        />
      )}
    </div>
  );
}

import { CategoryCombobox } from "@/components/category-combobox";
import type { JevConfidenceTier } from "@/lib/jev/confidence-tier";
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
  certaintyTier?: JevConfidenceTier | null;
  onCategoryChange: (rowId: string, categoryId: string) => void;
};

export function ImportReviewCategoryCell({
  rowId,
  rowNumber,
  selectedCategoryId,
  categories,
  certaintyTier,
  onCategoryChange,
}: ImportReviewCategoryCellProps) {
  const isUncategorized = selectedCategoryId.length === 0;

  return (
    <div className="flex items-center gap-1.5">
      {certaintyTier != null && (
        <ImportReviewCertaintyBar tier={certaintyTier} rowNumber={rowNumber} />
      )}
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
    </div>
  );
}

import { CategoryCombobox } from "@/components/category-combobox";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
};

type ImportReviewCategoryCellProps = {
  rowId: string;
  rowNumber: number;
  selectedCategoryId: string;
  categories: Category[];
  onCategoryChange: (rowId: string, categoryId: string) => void;
};

export function ImportReviewCategoryCell({
  rowId,
  rowNumber,
  selectedCategoryId,
  categories,
  onCategoryChange,
}: ImportReviewCategoryCellProps) {
  const isUncategorized = selectedCategoryId.length === 0;

  return (
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
  );
}

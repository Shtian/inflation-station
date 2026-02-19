import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const UNCATEGORIZED_SELECT_VALUE = "__uncategorized__";

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
    <Select
      value={selectedCategoryId || UNCATEGORIZED_SELECT_VALUE}
      onValueChange={(value) =>
        onCategoryChange(
          rowId,
          value === UNCATEGORIZED_SELECT_VALUE ? "" : value,
        )
      }
    >
      <SelectTrigger
        aria-label={`Category for row ${rowNumber}`}
        className={cn("w-[220px]", isUncategorized && "text-amber-500")}
      >
        <SelectValue placeholder="Uncategorized" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          value={UNCATEGORIZED_SELECT_VALUE}
          className="text-amber-500"
        >
          Uncategorized
        </SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

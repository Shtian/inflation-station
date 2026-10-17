import type { SuggestionSource } from "@prisma/client";
import {
  ArrowLeftRight,
  History,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { CategoryCombobox } from "@/components/category-combobox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { JevCertaintySignal } from "@/lib/jev/confidence-tier";
import { cn } from "@/lib/utils";
import { ImportReviewCertaintyBar } from "./import-review-certainty-bar";

type Category = {
  id: string;
  name: string;
};

type SuggestionSourceIndicator = {
  Icon: LucideIcon;
  label: string;
  description: string;
};

// Jev suggestions carry the certainty bar instead of a source indicator.
const SUGGESTION_SOURCE_INDICATOR: Record<
  SuggestionSource,
  SuggestionSourceIndicator | null
> = {
  RULE: {
    Icon: ListChecks,
    label: "Fra regel",
    description: "Kategorien kommer fra en av reglene dine",
  },
  HISTORY: {
    Icon: History,
    label: "Fra historikk",
    description: "Du har kategorisert kjøp fra samme sted slik før",
  },
  TRANSFER_MATCH: {
    Icon: ArrowLeftRight,
    label: "Koblet til overføring",
    description: "Ser ut som en overføring mellom kontoene dine",
  },
  OPENAI: null,
  JEV: null,
};

type ImportReviewCategoryCellProps = {
  rowId: string;
  rowNumber: number;
  selectedCategoryId: string;
  categories: Category[];
  certainty: JevCertaintySignal | null;
  suggestionSource: SuggestionSource | null;
  onCategoryChange: (rowId: string, categoryId: string) => void;
  onCreateCategory: (name: string) => Promise<Category | null>;
};

export function ImportReviewCategoryCell({
  rowId,
  rowNumber,
  selectedCategoryId,
  categories,
  certainty,
  suggestionSource,
  onCategoryChange,
  onCreateCategory,
}: ImportReviewCategoryCellProps) {
  const isUncategorized = selectedCategoryId.length === 0;
  const sourceIndicator =
    suggestionSource != null
      ? SUGGESTION_SOURCE_INDICATOR[suggestionSource]
      : null;

  return (
    <div className="flex items-center gap-1.5">
      <CategoryCombobox
        value={selectedCategoryId}
        categories={categories}
        onValueChange={(value) => onCategoryChange(rowId, value)}
        placeholder="Ukategorisert"
        emptyLabel="Ingen kategorier passer."
        ariaLabel={`Kategori for rad ${rowNumber}`}
        className={cn("w-[220px]", isUncategorized && "text-warning")}
        showClear
        onCreateCategory={onCreateCategory}
      />
      {certainty != null && (
        <ImportReviewCertaintyBar
          tier={certainty.tier}
          confidence={certainty.confidence}
          rowNumber={rowNumber}
        />
      )}
      {sourceIndicator != null && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label={sourceIndicator.label}
              className="inline-flex rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <sourceIndicator.Icon className="h-4 w-4" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="top">
              {sourceIndicator.description}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

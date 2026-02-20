import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

type CategoryOption = {
  id: string;
  name: string;
};

type CategoryComboboxProps = {
  value: string;
  categories: CategoryOption[];
  onValueChange: (value: string) => void;
  placeholder: string;
  emptyLabel?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  showClear?: boolean;
  portalContainer?: React.ComponentProps<
    typeof ComboboxContent
  >["portalContainer"];
};

export function CategoryCombobox({
  value,
  categories,
  onValueChange,
  placeholder,
  emptyLabel = "No categories found.",
  id,
  ariaLabel,
  className,
  disabled,
  showClear = true,
  portalContainer,
}: CategoryComboboxProps) {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return (
    <Combobox
      items={categories.map((category) => category.id)}
      value={value.length > 0 ? value : null}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
      itemToStringLabel={(itemValue) =>
        categoriesById.get(itemValue as string) ?? (itemValue as string)
      }
      autoHighlight
      disabled={disabled}
      modal={false}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        className={cn("w-full", className)}
        placeholder={placeholder}
        showClear={showClear}
      />
      <ComboboxContent portalContainer={portalContainer}>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(categoryId) => (
            <ComboboxItem key={categoryId as string} value={categoryId}>
              {categoriesById.get(categoryId as string) ?? String(categoryId)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

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
}: CategoryComboboxProps) {
  return (
    <Combobox
      value={value.length > 0 ? value : null}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
      autoHighlight
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        className={cn("w-full", className)}
        placeholder={placeholder}
        showClear={showClear}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {categories.map((category) => (
            <ComboboxItem key={category.id} value={category.id}>
              {category.name}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

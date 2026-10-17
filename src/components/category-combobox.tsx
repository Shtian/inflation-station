import { PlusIcon } from "lucide-react";
import { useState } from "react";
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

const CREATE_CATEGORY_ITEM = "__create_category__";

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
  container?: React.ComponentProps<typeof ComboboxContent>["container"];
  onCreateCategory?: (name: string) => Promise<CategoryOption | null>;
};

export function CategoryCombobox({
  value,
  categories,
  onValueChange,
  placeholder,
  emptyLabel = "Fant ingen kategorier.",
  id,
  ariaLabel,
  className,
  disabled,
  showClear = true,
  container,
  onCreateCategory,
}: CategoryComboboxProps) {
  const [inputValue, setInputValue] = useState("");
  const [creating, setCreating] = useState(false);
  const categoriesById = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const newName = inputValue.trim();
  const canCreate =
    onCreateCategory !== undefined &&
    newName.length > 0 &&
    !categories.some(
      (category) => category.name.toLowerCase() === newName.toLowerCase(),
    );
  const items = categories.map((category) => category.id);
  if (canCreate) {
    items.push(CREATE_CATEGORY_ITEM);
  }

  async function createCategory(name: string) {
    if (!onCreateCategory || creating) return;
    setCreating(true);
    try {
      const created = await onCreateCategory(name);
      if (created) onValueChange(created.id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Combobox
      items={items}
      value={value.length > 0 ? value : null}
      onValueChange={(nextValue) => {
        if (nextValue === CREATE_CATEGORY_ITEM) {
          void createCategory(newName);
          return;
        }
        onValueChange(nextValue ?? "");
      }}
      onInputValueChange={onCreateCategory ? setInputValue : undefined}
      itemToStringLabel={(itemValue) =>
        itemValue === CREATE_CATEGORY_ITEM
          ? newName
          : (categoriesById.get(itemValue as string) ?? (itemValue as string))
      }
      filter={(categoryId, query) => {
        if (!query || categoryId === CREATE_CATEGORY_ITEM) return true;
        const name =
          categoriesById.get(categoryId as string) ?? String(categoryId);
        return name.toLowerCase().includes(query.toLowerCase());
      }}
      autoHighlight
      disabled={disabled || creating}
      modal={false}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        className={cn("w-full", className)}
        placeholder={placeholder}
        showClear={showClear}
        onFocus={(event) => event.currentTarget.select()}
      />
      <ComboboxContent container={container}>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(categoryId) =>
            categoryId === CREATE_CATEGORY_ITEM ? (
              <ComboboxItem key={CREATE_CATEGORY_ITEM} value={categoryId}>
                <PlusIcon aria-hidden="true" />
                Opprett «{newName}»
              </ComboboxItem>
            ) : (
              <ComboboxItem key={categoryId as string} value={categoryId}>
                {categoriesById.get(categoryId as string) ?? String(categoryId)}
              </ComboboxItem>
            )
          }
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

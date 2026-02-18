import type { CategoryKind } from "@prisma/client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Account, Category } from "../categories-manager.types";
import { GLOBAL_SCOPE_VALUE, getScopeLabel } from "../categories-manager.utils";

type CategoryManagementSectionProps = {
  accounts: Account[];
  categories: Category[];
  loading: boolean;
  busyKey: string | null;
  newCategoryName: string;
  newCategoryKind: CategoryKind;
  newCategoryScope: string;
  onNewCategoryNameChange: (value: string) => void;
  onNewCategoryKindChange: (value: CategoryKind) => void;
  onNewCategoryScopeChange: (value: string) => void;
  onCreateCategory: () => void;
  onDeleteCategory: (categoryId: string) => void;
};

export function CategoryManagementSection({
  accounts,
  categories,
  loading,
  busyKey,
  newCategoryName,
  newCategoryKind,
  newCategoryScope,
  onNewCategoryNameChange,
  onNewCategoryKindChange,
  onNewCategoryScopeChange,
  onCreateCategory,
  onDeleteCategory,
}: CategoryManagementSectionProps) {
  const activeAccounts = accounts.filter((account) => account.isActive);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Category Management
        </h3>
        <p className="text-sm text-muted-foreground">
          Create and remove categories used in review and analytics.
        </p>
      </div>

      <div className="grid gap-3">
        <label
          htmlFor="new-category-name"
          className="text-sm font-medium text-foreground"
        >
          Category name
        </label>
        <Input
          id="new-category-name"
          value={newCategoryName}
          onChange={(event) => onNewCategoryNameChange(event.target.value)}
          placeholder="Groceries"
        />
        <label
          htmlFor="new-category-kind"
          className="text-sm font-medium text-foreground"
        >
          Kind
        </label>
        <Select
          value={newCategoryKind}
          onValueChange={(value) =>
            onNewCategoryKindChange(value as CategoryKind)
          }
        >
          <SelectTrigger id="new-category-kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
            <SelectItem value="TRANSFER">Transfer</SelectItem>
          </SelectContent>
        </Select>
        <label
          htmlFor="new-category-scope"
          className="text-sm font-medium text-foreground"
        >
          Scope
        </label>
        <Select
          value={newCategoryScope || GLOBAL_SCOPE_VALUE}
          onValueChange={(value) =>
            onNewCategoryScopeChange(value === GLOBAL_SCOPE_VALUE ? "" : value)
          }
        >
          <SelectTrigger id="new-category-scope" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GLOBAL_SCOPE_VALUE}>Global</SelectItem>
            {activeAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="secondary"
          onClick={onCreateCategory}
          disabled={busyKey === "new-category"}
          className="gap-2"
        >
          {busyKey === "new-category" ? (
            "Saving..."
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add category
            </>
          )}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>Loading categories...</TableCell>
              </TableRow>
            ) : null}
            {!loading && categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No categories yet.</TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <CategoryBadge label={category.name} />
                    </TableCell>
                    <TableCell>{category.kind}</TableCell>
                    <TableCell>
                      {getScopeLabel(category.accountId, accounts)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        onClick={() => onDeleteCategory(category.id)}
                        disabled={
                          busyKey !== null &&
                          busyKey !== `delete-category-${category.id}`
                        }
                        className="h-8 w-8 px-0"
                        aria-label={`Delete category ${category.name}`}
                        title={`Delete category ${category.name}`}
                      >
                        {busyKey === `delete-category-${category.id}` ? (
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

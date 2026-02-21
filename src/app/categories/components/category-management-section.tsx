import type { CategoryKind } from "@prisma/client";
import { Ellipsis, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  editingCategoryId: string | null;
  editCategoryName: string;
  onCreateCategory: () => void;
  onDeleteCategory: (categoryId: string) => void;
  onStartRenameCategory: (category: Category) => void;
  onCancelRenameCategory: () => void;
  onEditCategoryNameChange: (value: string) => void;
  onRenameCategory: (categoryId: string) => void;
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
  editingCategoryId,
  editCategoryName,
  onCreateCategory,
  onDeleteCategory,
  onStartRenameCategory,
  onCancelRenameCategory,
  onEditCategoryNameChange,
  onRenameCategory,
}: CategoryManagementSectionProps) {
  const activeAccounts = accounts.filter((account) => account.isActive);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-semibold text-base text-foreground">
          Category Management
        </h3>
        <p className="text-muted-foreground text-sm">
          Create and remove categories used in review and analytics.
        </p>
      </div>

      <div className="grid gap-3">
        <Label
          htmlFor="new-category-name"
          className="font-medium text-foreground text-sm"
        >
          Category name
        </Label>
        <Input
          id="new-category-name"
          value={newCategoryName}
          onChange={(event) => onNewCategoryNameChange(event.target.value)}
          placeholder="Groceries"
        />
        <Label
          htmlFor="new-category-kind"
          className="font-medium text-foreground text-sm"
        >
          Kind
        </Label>
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
        <Label
          htmlFor="new-category-scope"
          className="font-medium text-foreground text-sm"
        >
          Scope
        </Label>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Actions for category ${category.name}`}
                            title={`Actions for category ${category.name}`}
                            disabled={busyKey !== null}
                          >
                            {busyKey === `delete-category-${category.id}` ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Ellipsis
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onSelect={() => onStartRenameCategory(category)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Rename
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => onDeleteCategory(category.id)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={editingCategoryId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onCancelRenameCategory();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename category</DialogTitle>
            <DialogDescription>
              Update the category name. Existing transaction and rule links stay
              connected to the same category ID.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label
              htmlFor="edit-category-name"
              className="font-medium text-foreground text-sm"
            >
              Category name
            </Label>
            <Input
              id="edit-category-name"
              value={editCategoryName}
              onChange={(event) => onEditCategoryNameChange(event.target.value)}
              placeholder="Groceries"
              disabled={
                editingCategoryId !== null &&
                busyKey === `rename-category-${editingCategoryId}`
              }
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancelRenameCategory}
              disabled={
                editingCategoryId !== null &&
                busyKey === `rename-category-${editingCategoryId}`
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() =>
                editingCategoryId ? onRenameCategory(editingCategoryId) : null
              }
              disabled={
                editingCategoryId === null ||
                busyKey === `rename-category-${editingCategoryId}`
              }
            >
              {editingCategoryId !== null &&
              busyKey === `rename-category-${editingCategoryId}`
                ? "Saving..."
                : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

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
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
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
import type { Category } from "../categories-manager.types";

type CategoryManagementSectionProps = {
  categories: Category[];
  loading: boolean;
  busyKey: string | null;
  newCategoryName: string;
  newCategoryKind: CategoryKind;
  onNewCategoryNameChange: (value: string) => void;
  onNewCategoryKindChange: (value: CategoryKind) => void;
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
  categories,
  loading,
  busyKey,
  newCategoryName,
  newCategoryKind,
  onNewCategoryNameChange,
  onNewCategoryKindChange,
  editingCategoryId,
  editCategoryName,
  onCreateCategory,
  onDeleteCategory,
  onStartRenameCategory,
  onCancelRenameCategory,
  onEditCategoryNameChange,
  onRenameCategory,
}: CategoryManagementSectionProps) {
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
        <Field>
          <FieldLabel htmlFor="new-category-name">Category name</FieldLabel>
          <FieldContent>
            <Input
              id="new-category-name"
              value={newCategoryName}
              onChange={(event) => onNewCategoryNameChange(event.target.value)}
              placeholder="Groceries"
            />
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="new-category-kind">Kind</FieldLabel>
          <FieldContent>
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
          </FieldContent>
        </Field>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3}>Loading categories...</TableCell>
              </TableRow>
            ) : null}
            {!loading && categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>No categories yet.</TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <CategoryBadge label={category.name} />
                    </TableCell>
                    <TableCell>{category.kind}</TableCell>
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

          <Field>
            <FieldLabel htmlFor="edit-category-name">Category name</FieldLabel>
            <FieldContent>
              <Input
                id="edit-category-name"
                value={editCategoryName}
                onChange={(event) =>
                  onEditCategoryNameChange(event.target.value)
                }
                placeholder="Groceries"
                disabled={
                  editingCategoryId !== null &&
                  busyKey === `rename-category-${editingCategoryId}`
                }
              />
            </FieldContent>
          </Field>

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

import type { CategoryKind } from "@prisma/client";
import { Ellipsis, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { Badge } from "@/components/ui/badge";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
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
import { Textarea } from "@/components/ui/textarea";
import type { Category } from "../categories-manager.types";
import { hasClassifierHint } from "../categories-manager.utils";

const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  EXPENSE: "Expense",
  INCOME: "Income",
  TRANSFER: "Transfer",
};

const CLASSIFIER_HINT_LABEL = "Classifier hint (recommended)";
const CLASSIFIER_HINT_PLACEHOLDER =
  "Groceries: Rema 1000, Kiwi, Meny, Coop Extra, Joker, Bunnpris";
const CLASSIFIER_HINT_DESCRIPTION =
  "Describe what belongs here in plain words and list typical merchants as they appear on your bank statement.";

type CategoryManagementSectionProps = {
  categories: Category[];
  loading: boolean;
  busyKey: string | null;
  newCategoryName: string;
  newCategoryKind: CategoryKind;
  newCategoryClassifierHint: string;
  onNewCategoryNameChange: (value: string) => void;
  onNewCategoryKindChange: (value: CategoryKind) => void;
  onNewCategoryClassifierHintChange: (value: string) => void;
  editingCategoryId: string | null;
  editCategoryName: string;
  editCategoryClassifierHint: string;
  onCreateCategory: () => void;
  onDeleteCategory: (categoryId: string) => void;
  onStartRenameCategory: (category: Category) => void;
  onCancelRenameCategory: () => void;
  onEditCategoryNameChange: (value: string) => void;
  onEditCategoryClassifierHintChange: (value: string) => void;
  onRenameCategory: (categoryId: string) => void;
};

export function CategoryManagementSection({
  categories,
  loading,
  busyKey,
  newCategoryName,
  newCategoryKind,
  newCategoryClassifierHint,
  onNewCategoryNameChange,
  onNewCategoryKindChange,
  onNewCategoryClassifierHintChange,
  editingCategoryId,
  editCategoryName,
  editCategoryClassifierHint,
  onCreateCategory,
  onDeleteCategory,
  onStartRenameCategory,
  onCancelRenameCategory,
  onEditCategoryNameChange,
  onEditCategoryClassifierHintChange,
  onRenameCategory,
}: CategoryManagementSectionProps) {
  const missingHintCount = categories.filter(
    (category) => !hasClassifierHint(category),
  ).length;

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
              items={Object.entries(CATEGORY_KIND_LABELS).map(
                ([value, label]) => ({ value, label }),
              )}
              value={newCategoryKind}
              onValueChange={(value) =>
                onNewCategoryKindChange(value as CategoryKind)
              }
            >
              <SelectTrigger id="new-category-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_KIND_LABELS).map(([kind, label]) => (
                  <SelectItem key={kind} value={kind}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="new-category-classifier-hint">
            {CLASSIFIER_HINT_LABEL}
          </FieldLabel>
          <FieldContent>
            <Textarea
              id="new-category-classifier-hint"
              value={newCategoryClassifierHint}
              onChange={(event) =>
                onNewCategoryClassifierHintChange(event.target.value)
              }
              placeholder={CLASSIFIER_HINT_PLACEHOLDER}
              rows={2}
            />
            <FieldDescription>{CLASSIFIER_HINT_DESCRIPTION}</FieldDescription>
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

      {!loading && missingHintCount > 0 ? (
        <output className="block rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
          {missingHintCount === 1
            ? "1 category has no hint."
            : `${missingHintCount} categories have no hint.`}{" "}
          Hints improve automatic categorization.
        </output>
      ) : null}

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
                      <div className="flex items-center gap-2">
                        <CategoryBadge label={category.name} />
                        {hasClassifierHint(category) ? null : (
                          <Badge variant="outline">No hint</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{category.kind}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
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
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => onStartRenameCategory(category)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onDeleteCategory(category.id)}
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
            <DialogTitle>Edit category</DialogTitle>
            <DialogDescription>
              Update the category name and classifier hint. Existing transaction
              and rule links stay connected to the same category ID.
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

          <Field>
            <FieldLabel htmlFor="edit-category-classifier-hint">
              {CLASSIFIER_HINT_LABEL}
            </FieldLabel>
            <FieldContent>
              <Textarea
                id="edit-category-classifier-hint"
                value={editCategoryClassifierHint}
                onChange={(event) =>
                  onEditCategoryClassifierHintChange(event.target.value)
                }
                placeholder={CLASSIFIER_HINT_PLACEHOLDER}
                rows={2}
                disabled={
                  editingCategoryId !== null &&
                  busyKey === `rename-category-${editingCategoryId}`
                }
              />
              <FieldDescription>{CLASSIFIER_HINT_DESCRIPTION}</FieldDescription>
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

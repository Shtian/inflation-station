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
import { ClassifierHintEditor } from "./hint-editor/classifier-hint-editor";
import type { HintDraft, HintDraftAction } from "./hint-editor/hint-draft";

const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  EXPENSE: "Utgift",
  INCOME: "Inntekt",
  TRANSFER: "Overføring",
};

const CLASSIFIER_HINT_LABEL = "Klassifiseringshint (anbefalt)";
const CLASSIFIER_HINT_PLACEHOLDER =
  "Dagligvarer: Rema 1000, Kiwi, Meny, Coop Extra, Joker, Bunnpris";
const CLASSIFIER_HINT_DESCRIPTION =
  "Beskriv med vanlige ord hva som hører hjemme her, og list opp typiske brukersteder slik de står på kontoutskriften.";

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
  hintDraft: HintDraft | null;
  onHintAction: (action: HintDraftAction) => void;
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
  newCategoryClassifierHint,
  onNewCategoryNameChange,
  onNewCategoryKindChange,
  onNewCategoryClassifierHintChange,
  editingCategoryId,
  editCategoryName,
  hintDraft,
  onHintAction,
  onCreateCategory,
  onDeleteCategory,
  onStartRenameCategory,
  onCancelRenameCategory,
  onEditCategoryNameChange,
  onRenameCategory,
}: CategoryManagementSectionProps) {
  const missingHintCount = categories.filter(
    (category) => !hasClassifierHint(category),
  ).length;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Kategoriadministrasjon
        </h3>
        <p className="text-sm text-muted-foreground">
          Opprett og fjern kategorier som brukes i gjennomgang og analyser.
        </p>
      </div>

      <div className="grid gap-3">
        <Field>
          <FieldLabel htmlFor="new-category-name">Kategorinavn</FieldLabel>
          <FieldContent>
            <Input
              id="new-category-name"
              value={newCategoryName}
              onChange={(event) => onNewCategoryNameChange(event.target.value)}
              placeholder="Dagligvarer"
            />
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="new-category-kind">Kategoritype</FieldLabel>
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
            "Lagrer…"
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Legg til kategori
            </>
          )}
        </Button>
      </div>

      {!loading && missingHintCount > 0 ? (
        <output className="block rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {missingHintCount === 1
            ? "1 kategori mangler hint."
            : `${missingHintCount} kategorier mangler hint.`}{" "}
          Hint gir bedre automatisk kategorisering.
        </output>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Navn</TableHead>
              <TableHead>Kategoritype</TableHead>
              <TableHead className="text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3}>Laster inn kategorier…</TableCell>
              </TableRow>
            ) : null}
            {!loading && categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>Ingen kategorier ennå.</TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CategoryBadge label={category.name} />
                        {hasClassifierHint(category) ? null : (
                          <Badge variant="outline">Mangler hint</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{CATEGORY_KIND_LABELS[category.kind]}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={`Handlinger for kategorien ${category.name}`}
                              title={`Handlinger for kategorien ${category.name}`}
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
                              <span className="sr-only">Handlinger</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => onStartRenameCategory(category)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Rediger
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onDeleteCategory(category.id)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Slett
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
            <DialogTitle>Rediger kategori</DialogTitle>
            <DialogDescription>
              Oppdater kategorinavnet og klassifiseringshintet. Eksisterende
              koblinger til transaksjoner og regler beholder samme kategori-ID.
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="edit-category-name">Kategorinavn</FieldLabel>
            <FieldContent>
              <Input
                id="edit-category-name"
                value={editCategoryName}
                onChange={(event) =>
                  onEditCategoryNameChange(event.target.value)
                }
                placeholder="Dagligvarer"
                disabled={
                  editingCategoryId !== null &&
                  busyKey === `rename-category-${editingCategoryId}`
                }
              />
            </FieldContent>
          </Field>

          {hintDraft ? (
            <ClassifierHintEditor
              id="edit-category-classifier-hint"
              label={CLASSIFIER_HINT_LABEL}
              description={CLASSIFIER_HINT_DESCRIPTION}
              placeholder={CLASSIFIER_HINT_PLACEHOLDER}
              categoryName={editCategoryName}
              value={{ draft: hintDraft, dispatch: onHintAction }}
              disabled={busyKey === `rename-category-${hintDraft.categoryId}`}
            />
          ) : null}

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
              Avbryt
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
                ? "Lagrer…"
                : "Lagre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

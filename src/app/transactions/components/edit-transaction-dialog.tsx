import { useRef } from "react";
import { CategoryCombobox } from "@/components/category-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_TRANSACTION_NOTE_LENGTH } from "@/lib/transactions/note";
import {
  type Category,
  type EditFormState,
  PAYMENT_TYPE_OPTIONS,
  UNCATEGORIZED_VALUE,
} from "../transactions-manager.types";

type EditTransactionDialogProps = {
  open: boolean;
  categories: Category[];
  editForm: EditFormState | null;
  editError: string | null;
  noteError: string | null;
  editSaving: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  onCategoryChange: (value: string) => void;
  onBookingDateChange: (value: string) => void;
  onMerchantChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPaymentTypeChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function EditTransactionDialog({
  open,
  categories,
  editForm,
  editError,
  noteError,
  editSaving,
  onOpenChange,
  onCategoryChange,
  onBookingDateChange,
  onMerchantChange,
  onAmountChange,
  onPaymentTypeChange,
  onNoteChange,
  onCancel,
  onSubmit,
}: EditTransactionDialogProps) {
  const dialogContentRef = useRef<HTMLDivElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogContentRef}>
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
          <DialogDescription>
            Update mutable fields and save to keep this page in sync.
          </DialogDescription>
        </DialogHeader>

        {editForm ? (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label
                htmlFor="edit-category-id"
                className="text-sm font-medium text-foreground"
              >
                Category
              </Label>
              <CategoryCombobox
                value={
                  editForm.categoryId === UNCATEGORIZED_VALUE
                    ? ""
                    : editForm.categoryId
                }
                categories={categories}
                onValueChange={(value) =>
                  onCategoryChange(value || UNCATEGORIZED_VALUE)
                }
                id="edit-category-id"
                placeholder="Uncategorized"
                emptyLabel="No matching categories."
                disabled={editSaving}
                showClear
                portalContainer={dialogContentRef.current}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="edit-booking-date"
                className="text-sm font-medium text-foreground"
              >
                Date
              </Label>
              <Input
                id="edit-booking-date"
                type="date"
                value={editForm.bookingDate}
                onChange={(event) => onBookingDateChange(event.target.value)}
                disabled={editSaving}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="edit-normalized-merchant"
                className="text-sm font-medium text-foreground"
              >
                Merchant
              </Label>
              <Input
                id="edit-normalized-merchant"
                value={editForm.normalizedMerchant}
                onChange={(event) => onMerchantChange(event.target.value)}
                disabled={editSaving}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="edit-amount-nok"
                className="text-sm font-medium text-foreground"
              >
                Amount (NOK)
              </Label>
              <Input
                id="edit-amount-nok"
                inputMode="decimal"
                value={editForm.amountNok}
                onChange={(event) => onAmountChange(event.target.value)}
                disabled={editSaving}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="edit-payment-type"
                className="text-sm font-medium text-foreground"
              >
                Payment type
              </Label>
              <Select
                value={editForm.paymentType}
                onValueChange={onPaymentTypeChange}
                disabled={editSaving}
              >
                <SelectTrigger id="edit-payment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="edit-note"
                className="text-sm font-medium text-foreground"
              >
                Note
              </Label>
              <Input
                id="edit-note"
                value={editForm.note}
                onChange={(event) => onNoteChange(event.target.value)}
                aria-invalid={noteError !== null}
                disabled={editSaving}
              />
              <p
                className={`text-xs ${noteError ? "text-red-700" : "text-muted-foreground"}`}
              >
                {noteError ??
                  `${editForm.note.length}/${MAX_TRANSACTION_NOTE_LENGTH} characters`}
              </p>
            </div>

            {editError ? (
              <p
                role="alert"
                className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {editError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={editSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

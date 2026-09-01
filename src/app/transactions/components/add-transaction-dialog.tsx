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
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_TRANSACTION_NOTE_LENGTH } from "@/lib/transactions/note";
import { isFutureDate } from "../add-transaction-form";
import {
  type Account,
  type AddFormState,
  type Category,
  PAYMENT_TYPE_OPTIONS,
  UNCATEGORIZED_VALUE,
} from "../transactions-manager.types";

type AddTransactionDialogProps = {
  open: boolean;
  accounts: Account[];
  categories: Category[];
  addForm: AddFormState | null;
  addError: string | null;
  noteError: string | null;
  addSaving: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  onAccountChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onBookingDateChange: (value: string) => void;
  onMerchantChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPaymentTypeChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function AddTransactionDialog({
  open,
  accounts,
  categories,
  addForm,
  addError,
  noteError,
  addSaving,
  onOpenChange,
  onAccountChange,
  onCategoryChange,
  onBookingDateChange,
  onMerchantChange,
  onAmountChange,
  onPaymentTypeChange,
  onNoteChange,
  onCancel,
  onSubmit,
}: AddTransactionDialogProps) {
  const dialogContentRef = useRef<HTMLDivElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogContentRef}>
        <DialogHeader>
          <DialogTitle>Add transaction</DialogTitle>
          <DialogDescription>
            Manually record a new transaction to your account.
          </DialogDescription>
        </DialogHeader>

        {addForm ? (
          <form className="space-y-4" onSubmit={onSubmit}>
            <Field>
              <FieldLabel htmlFor="add-account-id">Account</FieldLabel>
              <FieldContent>
                <Select
                  items={accounts.map((account) => ({
                    value: account.id,
                    label: account.name,
                  }))}
                  value={addForm.accountId}
                  onValueChange={(value) => {
                    if (value === null) return;
                    onAccountChange(value);
                  }}
                  disabled={addSaving}
                >
                  <SelectTrigger id="add-account-id">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-booking-date">Date</FieldLabel>
              <FieldContent>
                <Input
                  id="add-booking-date"
                  type="date"
                  value={addForm.bookingDate}
                  onChange={(event) => onBookingDateChange(event.target.value)}
                  disabled={addSaving}
                />
                {isFutureDate(addForm.bookingDate) ? (
                  <p className="text-warning text-xs">
                    This date is in the future.
                  </p>
                ) : null}
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-merchant">Merchant</FieldLabel>
              <FieldContent>
                <Input
                  id="add-merchant"
                  value={addForm.merchant}
                  onChange={(event) => onMerchantChange(event.target.value)}
                  disabled={addSaving}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-amount-nok">Amount (NOK)</FieldLabel>
              <FieldContent>
                <Input
                  id="add-amount-nok"
                  inputMode="decimal"
                  value={addForm.amountNok}
                  onChange={(event) => onAmountChange(event.target.value)}
                  disabled={addSaving}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-payment-type">Payment type</FieldLabel>
              <FieldContent>
                <Select
                  value={addForm.paymentType}
                  onValueChange={(value) => {
                    if (value === null) return;
                    onPaymentTypeChange(value);
                  }}
                  disabled={addSaving}
                >
                  <SelectTrigger id="add-payment-type">
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
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-category-id">
                Category{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FieldLabel>
              <FieldContent>
                <CategoryCombobox
                  value={
                    addForm.categoryId === UNCATEGORIZED_VALUE
                      ? ""
                      : addForm.categoryId
                  }
                  categories={categories}
                  onValueChange={(value) =>
                    onCategoryChange(value || UNCATEGORIZED_VALUE)
                  }
                  id="add-category-id"
                  placeholder="Uncategorized"
                  emptyLabel="No matching categories."
                  disabled={addSaving}
                  showClear
                  container={dialogContentRef}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-note">
                Note{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FieldLabel>
              <FieldContent>
                <Input
                  id="add-note"
                  value={addForm.note}
                  onChange={(event) => onNoteChange(event.target.value)}
                  aria-invalid={noteError !== null}
                  disabled={addSaving}
                />
                <p
                  className={`text-xs ${noteError ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {noteError ??
                    `${addForm.note.length}/${MAX_TRANSACTION_NOTE_LENGTH} characters`}
                </p>
              </FieldContent>
            </Field>

            {addError ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
              >
                {addError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={addSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addSaving}>
                {addSaving ? "Saving..." : "Add transaction"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

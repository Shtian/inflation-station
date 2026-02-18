"use client";

import { useCallback, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TransactionsTableSection } from "./components/transactions-table-section";
import {
  ALL_ACCOUNTS_VALUE,
  type EditFormState,
  PAYMENT_TYPE_OPTIONS,
  type PaymentTypeOption,
  type TransactionRow,
  UNCATEGORIZED_VALUE,
} from "./transactions-manager.types";
import { useTransactionsManager } from "./use-transactions-manager";

function getMutationErrorMessage(body: unknown, fallback: string) {
  if (typeof body === "object" && body && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  if (typeof body === "object" && body && "error" in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === "string" && error.length > 0) {
      return error;
    }
  }

  return fallback;
}

function toPaymentTypeOption(value: string): PaymentTypeOption {
  if (PAYMENT_TYPE_OPTIONS.includes(value as PaymentTypeOption)) {
    return value as PaymentTypeOption;
  }

  return "OTHER";
}

function toEditFormState(row: TransactionRow): EditFormState {
  return {
    categoryId: row.categoryId ?? UNCATEGORIZED_VALUE,
    bookingDate: row.bookingDate,
    amountNok: row.amountNok.toFixed(2),
    normalizedMerchant: row.normalizedMerchant,
    paymentType: toPaymentTypeOption(row.paymentType),
  };
}

export function TransactionsManager() {
  const {
    accounts,
    categories,
    accountId,
    pageSize,
    loading,
    error,
    transactions,
    loadTransactions,
    goToPage,
    setAccountFilter,
    setPageSizeFilter,
  } = useTransactionsManager();

  const [editingTransaction, setEditingTransaction] =
    useState<TransactionRow | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingTransaction, setDeletingTransaction] =
    useState<TransactionRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const closeEditDialog = useCallback(() => {
    setEditingTransaction(null);
    setEditForm(null);
    setEditError(null);
    setEditSaving(false);
  }, []);

  const openEditDialog = useCallback((row: TransactionRow) => {
    setEditingTransaction(row);
    setEditForm(toEditFormState(row));
    setEditError(null);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeletingTransaction(null);
    setDeleteError(null);
    setDeleteSaving(false);
  }, []);

  const openDeleteDialog = useCallback((row: TransactionRow) => {
    setDeletingTransaction(row);
    setDeleteError(null);
  }, []);

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTransaction || !editForm) {
      return;
    }

    const amountNok = Number.parseFloat(editForm.amountNok.replace(",", "."));
    if (!Number.isFinite(amountNok)) {
      setEditError("Amount must be a valid number.");
      return;
    }

    const bookingDate = editForm.bookingDate.trim();
    const normalizedMerchant = editForm.normalizedMerchant.trim();

    if (!bookingDate || !normalizedMerchant) {
      setEditError("Date and merchant are required.");
      return;
    }

    setEditSaving(true);
    setEditError(null);

    const response = await fetch(`/api/transactions/${editingTransaction.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        categoryId:
          editForm.categoryId === UNCATEGORIZED_VALUE
            ? null
            : editForm.categoryId,
        bookingDate,
        amountNok,
        normalizedMerchant,
        paymentType: editForm.paymentType,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setEditError(
        getMutationErrorMessage(body, "Could not update transaction."),
      );
      setEditSaving(false);
      return;
    }

    await loadTransactions();
    closeEditDialog();
  }

  async function handleDeleteConfirm() {
    if (!deletingTransaction) {
      return;
    }

    setDeleteSaving(true);
    setDeleteError(null);

    const response = await fetch(
      `/api/transactions/${deletingTransaction.id}`,
      {
        method: "DELETE",
      },
    );
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setDeleteError(
        getMutationErrorMessage(body, "Could not delete transaction."),
      );
      setDeleteSaving(false);
      return;
    }

    await loadTransactions();
    closeDeleteDialog();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Transactions
        </h1>
        <p className="text-sm text-muted-foreground">
          Filter and page through imported transactions.
        </p>
      </div>

      <Separator className="my-4" />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <label
            htmlFor="transactions-account-filter"
            className="block text-sm font-medium text-foreground"
          >
            Account
          </label>
          <Select
            value={accountId || ALL_ACCOUNTS_VALUE}
            onValueChange={(value) =>
              setAccountFilter(value === ALL_ACCOUNTS_VALUE ? "" : value)
            }
          >
            <SelectTrigger id="transactions-account-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACCOUNTS_VALUE}>All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <Separator className="my-4" />

      <TransactionsTableSection
        loading={loading}
        transactions={transactions}
        onEdit={openEditDialog}
        onDelete={openDeleteDialog}
        pageSize={pageSize}
        onPageSizeChange={setPageSizeFilter}
        onGoToPage={goToPage}
      />

      <Dialog
        open={editingTransaction !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !editSaving) {
            closeEditDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
            <DialogDescription>
              Update mutable fields and save to keep this page in sync.
            </DialogDescription>
          </DialogHeader>

          {editForm ? (
            <form className="space-y-4" onSubmit={handleEditSubmit}>
              <div className="space-y-2">
                <label
                  htmlFor="edit-category-id"
                  className="text-sm font-medium text-foreground"
                >
                  Category
                </label>
                <Select
                  value={editForm.categoryId}
                  onValueChange={(value) =>
                    setEditForm((current) =>
                      current ? { ...current, categoryId: value } : current,
                    )
                  }
                  disabled={editSaving}
                >
                  <SelectTrigger id="edit-category-id">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNCATEGORIZED_VALUE}>
                      Uncategorized
                    </SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="edit-booking-date"
                  className="text-sm font-medium text-foreground"
                >
                  Date
                </label>
                <Input
                  id="edit-booking-date"
                  type="date"
                  value={editForm.bookingDate}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, bookingDate: event.target.value }
                        : current,
                    )
                  }
                  disabled={editSaving}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="edit-normalized-merchant"
                  className="text-sm font-medium text-foreground"
                >
                  Merchant
                </label>
                <Input
                  id="edit-normalized-merchant"
                  value={editForm.normalizedMerchant}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, normalizedMerchant: event.target.value }
                        : current,
                    )
                  }
                  disabled={editSaving}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="edit-amount-nok"
                  className="text-sm font-medium text-foreground"
                >
                  Amount (NOK)
                </label>
                <Input
                  id="edit-amount-nok"
                  inputMode="decimal"
                  value={editForm.amountNok}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, amountNok: event.target.value }
                        : current,
                    )
                  }
                  disabled={editSaving}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="edit-payment-type"
                  className="text-sm font-medium text-foreground"
                >
                  Payment type
                </label>
                <Select
                  value={editForm.paymentType}
                  onValueChange={(value) =>
                    setEditForm((current) =>
                      current
                        ? {
                            ...current,
                            paymentType: toPaymentTypeOption(value),
                          }
                        : current,
                    )
                  }
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
                  onClick={closeEditDialog}
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

      <AlertDialog
        open={deletingTransaction !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteSaving) {
            closeDeleteDialog();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError ? (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {deleteError}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={closeDeleteDialog}
              disabled={deleteSaving}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={deleteSaving}
            >
              {deleteSaving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

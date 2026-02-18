"use client";

import { useCallback, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DeleteTransactionDialog } from "./components/delete-transaction-dialog";
import { EditTransactionDialog } from "./components/edit-transaction-dialog";
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

      <EditTransactionDialog
        open={editingTransaction !== null}
        categories={categories}
        editForm={editForm}
        editError={editError}
        editSaving={editSaving}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !editSaving) {
            closeEditDialog();
          }
        }}
        onCategoryChange={(value) =>
          setEditForm((current) =>
            current ? { ...current, categoryId: value } : current,
          )
        }
        onBookingDateChange={(value) =>
          setEditForm((current) =>
            current ? { ...current, bookingDate: value } : current,
          )
        }
        onMerchantChange={(value) =>
          setEditForm((current) =>
            current ? { ...current, normalizedMerchant: value } : current,
          )
        }
        onAmountChange={(value) =>
          setEditForm((current) =>
            current ? { ...current, amountNok: value } : current,
          )
        }
        onPaymentTypeChange={(value) =>
          setEditForm((current) =>
            current
              ? { ...current, paymentType: toPaymentTypeOption(value) }
              : current,
          )
        }
        onCancel={closeEditDialog}
        onSubmit={handleEditSubmit}
      />

      <DeleteTransactionDialog
        open={deletingTransaction !== null}
        deleteError={deleteError}
        deleteSaving={deleteSaving}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteSaving) {
            closeDeleteDialog();
          }
        }}
        onCancel={closeDeleteDialog}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

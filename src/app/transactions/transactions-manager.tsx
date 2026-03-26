"use client";

import { useCallback, useState } from "react";
import { Separator } from "@/components/ui/separator";
import {
  MAX_TRANSACTION_NOTE_LENGTH,
  MAX_TRANSACTION_NOTE_LENGTH_MESSAGE,
} from "@/lib/transactions/note";
import { DeleteTransactionDialog } from "./components/delete-transaction-dialog";
import { EditTransactionDialog } from "./components/edit-transaction-dialog";
import { TransactionsTableSection } from "./components/transactions-table-section";
import {
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
    note: row.note ?? "",
  };
}

export function TransactionsManager() {
  const {
    accounts,
    categories,
    accountId,
    categoryId,
    globalQuery,
    dateFrom,
    dateTo,
    sorting,
    pageSize,
    loading,
    error,
    transactions,
    loadTransactions,
    goToPage,
    setAccountFilter,
    setCategoryFilter,
    setGlobalQueryFilter,
    setDateFromFilter,
    setDateToFilter,
    setSorting,
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
  const noteError =
    editForm && editForm.note.trim().length > MAX_TRANSACTION_NOTE_LENGTH
      ? MAX_TRANSACTION_NOTE_LENGTH_MESSAGE
      : null;

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
    const note = editForm.note.trim();

    if (!bookingDate || !normalizedMerchant) {
      setEditError("Date and merchant are required.");
      return;
    }

    if (note.length > MAX_TRANSACTION_NOTE_LENGTH) {
      setEditError(MAX_TRANSACTION_NOTE_LENGTH_MESSAGE);
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
        note: note.length > 0 ? note : null,
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
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Transactions
        </h1>
        <p className="text-muted-foreground text-sm">
          Filter and page through imported transactions.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {error}
        </p>
      ) : null}

      <Separator className="my-4" />

      <TransactionsTableSection
        loading={loading}
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        accountId={accountId}
        categoryId={categoryId}
        globalQuery={globalQuery}
        dateFrom={dateFrom}
        dateTo={dateTo}
        sorting={sorting}
        onEdit={openEditDialog}
        onDelete={openDeleteDialog}
        onAccountFilterChange={setAccountFilter}
        onCategoryFilterChange={setCategoryFilter}
        onGlobalQueryChange={setGlobalQueryFilter}
        onDateFromChange={setDateFromFilter}
        onDateToChange={setDateToFilter}
        onSortingChange={setSorting}
        pageSize={pageSize}
        onPageSizeChange={setPageSizeFilter}
        onGoToPage={goToPage}
      />

      <EditTransactionDialog
        open={editingTransaction !== null}
        categories={categories}
        editForm={editForm}
        editError={editError}
        noteError={noteError}
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
        onNoteChange={(value) =>
          setEditForm((current) =>
            current ? { ...current, note: value } : current,
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

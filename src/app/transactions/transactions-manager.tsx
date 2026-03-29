"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  MAX_TRANSACTION_NOTE_LENGTH,
  MAX_TRANSACTION_NOTE_LENGTH_MESSAGE,
} from "@/lib/transactions/note";
import { buildInitialAddForm, validateAddForm } from "./add-transaction-form";
import { AddTransactionDialog } from "./components/add-transaction-dialog";
import { BulkDeleteTransactionsDialog } from "./components/bulk-delete-transactions-dialog";
import { DeleteTransactionDialog } from "./components/delete-transaction-dialog";
import { EditTransactionDialog } from "./components/edit-transaction-dialog";
import { TransactionsTableSection } from "./components/transactions-table-section";
import {
  type AddFormState,
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
    merchant: row.merchant ?? row.normalizedMerchant,
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
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const noteError =
    editForm && editForm.note.trim().length > MAX_TRANSACTION_NOTE_LENGTH
      ? MAX_TRANSACTION_NOTE_LENGTH_MESSAGE
      : null;
  const addNoteError =
    addForm && addForm.note.trim().length > MAX_TRANSACTION_NOTE_LENGTH
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

  const closeBulkDeleteDialog = useCallback(() => {
    setBulkDeleteIds([]);
    setBulkDeleteError(null);
    setBulkDeleteSaving(false);
  }, []);

  const openBulkDeleteDialog = useCallback((ids: string[]) => {
    setBulkDeleteIds(ids);
    setBulkDeleteError(null);
  }, []);

  const closeAddDialog = useCallback(() => {
    setAddForm(null);
    setAddError(null);
    setAddSaving(false);
  }, []);

  const openAddDialog = useCallback(() => {
    setAddForm(buildInitialAddForm({ accountId, categoryId, dateFrom }));
    setAddError(null);
  }, [accountId, categoryId, dateFrom]);

  async function handleAddSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!addForm) {
      return;
    }

    const validation = validateAddForm(addForm);
    if (!validation.valid) {
      setAddError(validation.error);
      return;
    }

    setAddSaving(true);
    setAddError(null);

    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: validation.accountId,
        bookingDate: validation.bookingDate,
        amountNok: validation.amountNok,
        merchant: validation.merchant,
        paymentType: addForm.paymentType,
        categoryId:
          addForm.categoryId === UNCATEGORIZED_VALUE
            ? undefined
            : addForm.categoryId,
        note: validation.note.length > 0 ? validation.note : undefined,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setAddError(getMutationErrorMessage(body, "Could not add transaction."));
      setAddSaving(false);
      return;
    }

    closeAddDialog();
    await loadTransactions();
    toast.success("Transaction added");
  }

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
    const merchant = editForm.merchant.trim();
    const note = editForm.note.trim();

    if (!bookingDate || !merchant) {
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
        merchant,
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

  async function handleBulkDeleteConfirm() {
    if (bulkDeleteIds.length === 0) {
      return;
    }

    setBulkDeleteSaving(true);
    setBulkDeleteError(null);

    const response = await fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: bulkDeleteIds }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setBulkDeleteError(
        getMutationErrorMessage(body, "Could not delete transactions."),
      );
      setBulkDeleteSaving(false);
      return;
    }

    const count = bulkDeleteIds.length;
    closeBulkDeleteDialog();
    await loadTransactions();
    toast.success(`Deleted ${count} transaction${count !== 1 ? "s" : ""}`);
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
        onAdd={openAddDialog}
        onEdit={openEditDialog}
        onDelete={openDeleteDialog}
        onBulkDelete={openBulkDeleteDialog}
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

      <AddTransactionDialog
        open={addForm !== null}
        accounts={accounts}
        categories={categories}
        addForm={addForm}
        addError={addError}
        noteError={addNoteError}
        addSaving={addSaving}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !addSaving) {
            closeAddDialog();
          }
        }}
        onAccountChange={(value) =>
          setAddForm((current) =>
            current ? { ...current, accountId: value } : current,
          )
        }
        onCategoryChange={(value) =>
          setAddForm((current) =>
            current ? { ...current, categoryId: value } : current,
          )
        }
        onBookingDateChange={(value) =>
          setAddForm((current) =>
            current ? { ...current, bookingDate: value } : current,
          )
        }
        onMerchantChange={(value) =>
          setAddForm((current) =>
            current ? { ...current, merchant: value } : current,
          )
        }
        onAmountChange={(value) =>
          setAddForm((current) =>
            current ? { ...current, amountNok: value } : current,
          )
        }
        onPaymentTypeChange={(value) =>
          setAddForm((current) =>
            current
              ? { ...current, paymentType: toPaymentTypeOption(value) }
              : current,
          )
        }
        onNoteChange={(value) =>
          setAddForm((current) =>
            current ? { ...current, note: value } : current,
          )
        }
        onCancel={closeAddDialog}
        onSubmit={handleAddSubmit}
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
            current ? { ...current, merchant: value } : current,
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

      <BulkDeleteTransactionsDialog
        open={bulkDeleteIds.length > 0}
        count={bulkDeleteIds.length}
        deleteError={bulkDeleteError}
        deleteSaving={bulkDeleteSaving}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !bulkDeleteSaving) {
            closeBulkDeleteDialog();
          }
        }}
        onCancel={closeBulkDeleteDialog}
        onConfirm={handleBulkDeleteConfirm}
      />
    </div>
  );
}

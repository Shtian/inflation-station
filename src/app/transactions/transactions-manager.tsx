"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Ellipsis,
  Pencil,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Account = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
  accountId: string | null;
};

type TransactionRow = {
  id: string;
  accountId: string;
  categoryId: string | null;
  categoryName: string | null;
  bookingDate: string;
  amountNok: number;
  currency: string;
  normalizedMerchant: string;
  paymentType: string;
};

type TransactionsResponse = {
  rows: TransactionRow[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

type EditFormState = {
  categoryId: string;
  bookingDate: string;
  amountNok: string;
  normalizedMerchant: string;
  paymentType: PaymentTypeOption;
};

const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"] as const;
const ALL_ACCOUNTS_VALUE = "__all_accounts__";
const UNCATEGORIZED_VALUE = "__uncategorized__";
const PAYMENT_TYPE_OPTIONS = [
  "CARD",
  "TRANSFER",
  "EFT",
  "CASH",
  "OTHER",
] as const;
type PaymentTypeOption = (typeof PAYMENT_TYPE_OPTIONS)[number];

function formatNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getTransactionsErrorMessage(body: unknown) {
  if (typeof body === "object" && body && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return "Could not load transactions.";
}

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionsResponse | null>(
    null,
  );
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

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/accounts");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("accounts" in body) ||
      !Array.isArray(body.accounts)
    ) {
      setAccounts([]);
      return;
    }

    setAccounts(
      (body.accounts as Array<{ id: string; name: string }>).map((next) => ({
        id: next.id,
        name: next.name,
      })),
    );
  }, []);

  const loadCategories = useCallback(async () => {
    const response = await fetch("/api/categories");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("categories" in body) ||
      !Array.isArray(body.categories)
    ) {
      setCategories([]);
      return;
    }

    setCategories(
      (
        body.categories as Array<{
          id: string;
          name: string;
          accountId: string | null;
        }>
      ).map((next) => ({
        id: next.id,
        name: next.name,
        accountId: next.accountId,
      })),
    );
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (accountId) {
      params.set("accountId", accountId);
    }

    const response = await fetch(`/api/transactions?${params.toString()}`);
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("rows" in body) ||
      !("pagination" in body)
    ) {
      setTransactions(null);
      setError(getTransactionsErrorMessage(body));
      setLoading(false);
      return;
    }

    const parsed = body as TransactionsResponse;
    const totalPages = Math.max(1, parsed.pagination.totalPages || 1);
    const nextPage = Math.min(page, totalPages);

    if (nextPage !== page) {
      setPage(nextPage);
      setLoading(false);
      return;
    }

    setTransactions(parsed);
    setLoading(false);
  }, [accountId, page, pageSize]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  function goToPage(nextPage: number) {
    const max = Math.max(1, transactions?.pagination.totalPages ?? 1);
    const clamped = Math.min(Math.max(1, nextPage), max);
    setPage(clamped);
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
            onValueChange={(value) => {
              setAccountId(value === ALL_ACCOUNTS_VALUE ? "" : value);
              setPage(1);
            }}
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading transactions...</p>
      ) : null}

      {!loading && transactions ? (
        <section className="space-y-2" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            {transactions.pagination.total} total transactions.
          </p>

          {transactions.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions found for the selected filters.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Payment type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-0 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.bookingDate}</TableCell>
                      <TableCell>
                        {row.normalizedMerchant || "Unknown"}
                      </TableCell>
                      <TableCell>
                        {row.categoryName ?? "Uncategorized"}
                      </TableCell>
                      <TableCell>{row.paymentType}</TableCell>
                      <TableCell className="text-right">
                        {formatNok(row.amountNok)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={`Actions for transaction from ${row.bookingDate}`}
                              title={`Actions for transaction from ${row.bookingDate}`}
                            >
                              <Ellipsis
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onSelect={() => openEditDialog(row)}
                              >
                                <Pencil
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Edit
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => openDeleteDialog(row)}
                              >
                                <Trash2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex w-full justify-center sm:justify-end">
                <div className="flex flex-col items-center gap-2 text-sm text-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      Rows per page:
                    </span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(value) => {
                        setPageSize(Number.parseInt(value, 10));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger
                        id="transactions-rows-per-page"
                        className="h-8 w-[84px]"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span>
                    Page {transactions.pagination.page} of{" "}
                    {Math.max(1, transactions.pagination.totalPages)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Go to first page"
                      onClick={() => goToPage(1)}
                      disabled={loading || transactions.pagination.page <= 1}
                    >
                      <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Go to previous page"
                      onClick={() => goToPage(transactions.pagination.page - 1)}
                      disabled={loading || transactions.pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Go to next page"
                      onClick={() => goToPage(transactions.pagination.page + 1)}
                      disabled={
                        loading ||
                        transactions.pagination.page >=
                          Math.max(1, transactions.pagination.totalPages)
                      }
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Go to last page"
                      onClick={() =>
                        goToPage(
                          Math.max(1, transactions.pagination.totalPages),
                        )
                      }
                      disabled={
                        loading ||
                        transactions.pagination.page >=
                          Math.max(1, transactions.pagination.totalPages)
                      }
                    >
                      <ChevronsRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}

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

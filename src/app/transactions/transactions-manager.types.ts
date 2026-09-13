import type { PaymentType } from "@prisma/client";
import type { TransactionRow as DomainTransactionRow } from "@/lib/transactions/row";

export type Account = {
  id: string;
  name: string;
};

export type Category = {
  id: string;
  name: string;
  accountId: string | null;
};

export type TransactionRow = Omit<
  DomainTransactionRow,
  "createdAt" | "updatedAt"
>;

export type TransactionsResponse = {
  rows: TransactionRow[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"] as const;
export const TRANSACTIONS_SORT_FIELDS = [
  "bookingDate",
  "amountNok",
  "merchant",
  "category",
] as const;
export const ALL_ACCOUNTS_VALUE = "__all_accounts__";
export const ALL_CATEGORIES_VALUE = "__all_categories__";
export const UNCATEGORIZED_VALUE = "__uncategorized__";
export const PAYMENT_TYPE_OPTIONS = [
  "CARD",
  "TRANSFER",
  "EFT",
  "CASH",
  "OTHER",
] as const satisfies readonly PaymentType[];
export type TransactionSortField = (typeof TRANSACTIONS_SORT_FIELDS)[number];
export type TransactionSortDirection = "asc" | "desc";
export type TransactionSorting = {
  field: TransactionSortField;
  direction: TransactionSortDirection;
};
export type PaymentTypeOption = (typeof PAYMENT_TYPE_OPTIONS)[number];

export type EditFormState = {
  categoryId: string;
  bookingDate: string;
  amountNok: string;
  merchant: string;
  paymentType: PaymentTypeOption;
  note: string;
};

export type AddFormState = EditFormState & { accountId: string };

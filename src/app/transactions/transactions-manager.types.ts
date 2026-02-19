export type Account = {
  id: string;
  name: string;
};

export type Category = {
  id: string;
  name: string;
  accountId: string | null;
};

export type TransactionRow = {
  id: string;
  accountId: string;
  categoryId: string | null;
  categoryName: string | null;
  bookingDate: string;
  amountNok: number;
  currency: string;
  normalizedMerchant: string;
  paymentType: string;
  note: string | null;
};

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
export const ALL_ACCOUNTS_VALUE = "__all_accounts__";
export const UNCATEGORIZED_VALUE = "__uncategorized__";
export const PAYMENT_TYPE_OPTIONS = [
  "CARD",
  "TRANSFER",
  "EFT",
  "CASH",
  "OTHER",
] as const;
export type PaymentTypeOption = (typeof PAYMENT_TYPE_OPTIONS)[number];

export type EditFormState = {
  categoryId: string;
  bookingDate: string;
  amountNok: string;
  normalizedMerchant: string;
  paymentType: PaymentTypeOption;
  note: string;
};

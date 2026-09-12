import type { PaymentType, Prisma } from "@prisma/client";

export const TRANSACTION_ROW_SELECT = {
  id: true,
  accountId: true,
  account: {
    select: {
      name: true,
    },
  },
  categoryId: true,
  category: {
    select: {
      name: true,
    },
  },
  bookingDate: true,
  amountNok: true,
  currency: true,
  normalizedMerchant: true,
  merchant: true,
  paymentType: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TransactionSelect;

export type TransactionRowRecord = Prisma.TransactionGetPayload<{
  select: typeof TRANSACTION_ROW_SELECT;
}>;

export type TransactionRow = {
  id: string;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  /** `YYYY-MM-DD`, the UTC calendar day the transaction was booked. */
  bookingDate: string;
  amountNok: number;
  currency: string;
  normalizedMerchant: string;
  merchant: string | null;
  paymentType: PaymentType;
  note: string | null;
  /** ISO-8601 instant. */
  createdAt: string;
  /** ISO-8601 instant. */
  updatedAt: string;
};

export function toTransactionRow(record: TransactionRowRecord): TransactionRow {
  return {
    id: record.id,
    accountId: record.accountId,
    accountName: record.account.name,
    categoryId: record.categoryId,
    categoryName: record.category?.name ?? null,
    bookingDate: record.bookingDate.toISOString().slice(0, 10),
    amountNok: Number.parseFloat(record.amountNok.toString()),
    currency: record.currency,
    normalizedMerchant: record.normalizedMerchant,
    merchant: record.merchant,
    paymentType: record.paymentType,
    note: record.note,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

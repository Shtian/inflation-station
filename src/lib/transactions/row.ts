import type { PaymentType, Prisma } from "@prisma/client";

/**
 * The one relational selection every transaction-returning query uses.
 * `getTransactionsPage`, `createTransaction` and `updateTransaction` all pass
 * this literal to Prisma, so the public row and the query that feeds it cannot
 * drift.
 *
 * `satisfies` (not `:`) keeps the `true` literals so `TransactionRowRecord`
 * below can be derived from it.
 */
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

/**
 * The persistence shape `TRANSACTION_ROW_SELECT` yields. Internal to
 * `src/lib/transactions`; it exists so the write and list db-client types can
 * name their return value without restating the field list.
 */
export type TransactionRowRecord = Prisma.TransactionGetPayload<{
  select: typeof TRANSACTION_ROW_SELECT;
}>;

/**
 * The public transaction representation. `getTransactionsPage`,
 * `createTransaction` and `updateTransaction` all return exactly this.
 *
 * Hand-written on purpose: it is the contract browsers and routes read, so it
 * stays legible and independent of how the row happens to be stored. The
 * *record* above is derived, because record and select must agree by
 * construction.
 */
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

/**
 * Projects a selected record into the public row: decimal to number, instants
 * to ISO strings, booking date to its UTC calendar day, relations flattened to
 * display names.
 */
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

import type { PrismaClient } from "@prisma/client";
import { getTransactionsPage } from "@/lib/transactions/list";
import { toLocalDayBounds } from "./local-day";

export type SearchTransactionsInput = {
  from?: string;
  to?: string;
  categoryId?: string;
  accountId?: string;
  query?: string;
  limit?: number;
};

export type TransactionSearchResult = {
  range: { from: string | null; to: string | null };
  filters: {
    categoryId: string | null;
    accountId: string | null;
    query: string | null;
  };
  limit: number;
  total: number;
  truncated: boolean;
  transactions: Array<{
    id: string;
    bookingDate: string;
    amountNok: number;
    merchant: string;
    categoryName: string | null;
    accountName: string;
    note: string | null;
  }>;
};

export const SEARCH_LIMIT_DEFAULT = 25;
export const SEARCH_LIMIT_MAX = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function searchTransactions(
  db: PrismaClient,
  input: SearchTransactionsInput,
): Promise<TransactionSearchResult> {
  const { start, end } = toLocalDayBounds(input);
  const limit = Math.min(input.limit ?? SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX);
  const query = input.query?.trim() || null;

  const { rows, pagination } = await getTransactionsPage(db, {
    accountId: input.accountId,
    categoryId: input.categoryId,
    query: query ?? undefined,
    dateFrom: start,
    // list.ts adds a flat 24h to dateTo, so step back 24h from the next local midnight to land on it across DST.
    dateTo: end ? new Date(end.getTime() - DAY_MS) : undefined,
    page: 1,
    pageSize: limit,
  });

  return {
    range: { from: input.from ?? null, to: input.to ?? null },
    filters: {
      categoryId: input.categoryId ?? null,
      accountId: input.accountId ?? null,
      query,
    },
    limit,
    total: pagination.total,
    truncated: pagination.total > rows.length,
    transactions: rows.map((row) => ({
      id: row.id,
      bookingDate: row.bookingDate,
      amountNok: row.amountNok,
      merchant: row.merchant ?? row.normalizedMerchant,
      categoryName: row.categoryName,
      accountName: row.accountName,
      note: row.note,
    })),
  };
}

import type { Prisma } from "@prisma/client";
import { categoryFilterWhere } from "./category-filter";
import { normalizeMerchantKey } from "./merchant";
import {
  TRANSACTION_ROW_SELECT,
  type TransactionRow,
  type TransactionRowRecord,
  toTransactionRow,
} from "./row";

type TransactionListDbClient = {
  transaction: {
    count(args: { where: Prisma.TransactionWhereInput }): Promise<number>;
    findMany(args: {
      where: Prisma.TransactionWhereInput;
      select: typeof TRANSACTION_ROW_SELECT;
      orderBy: Prisma.TransactionOrderByWithRelationInput[];
      skip: number;
      take: number;
    }): Promise<TransactionRowRecord[]>;
  };
};

export type TransactionsListFilters = {
  accountId?: string;
  categoryId?: string;
  query?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sorting?: {
    field: "bookingDate" | "amountNok" | "merchant" | "category";
    direction: "asc" | "desc";
  };
  page: number;
  pageSize: number;
};

export type TransactionsListResult = {
  rows: TransactionRow[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

function addUtcDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function getOrderBy(
  sorting: TransactionsListFilters["sorting"],
): Prisma.TransactionOrderByWithRelationInput[] {
  if (!sorting) {
    return [{ bookingDate: "desc" }, { id: "desc" }];
  }

  switch (sorting.field) {
    case "bookingDate":
      return [{ bookingDate: sorting.direction }, { id: sorting.direction }];
    case "amountNok":
      return [{ amountNok: sorting.direction }, { id: sorting.direction }];
    case "merchant":
      return [{ merchant: sorting.direction }, { id: sorting.direction }];
    case "category":
      return [
        {
          category: {
            name: sorting.direction,
          },
        },
        { id: sorting.direction },
      ];
  }
}

/**
 * The free-text match behind the `/transactions` search, shared with the trip
 * search so one query finds the same rows in both places. `null` for a blank
 * query.
 */
export function transactionTextWhere(
  query: string,
): { OR: Prisma.TransactionWhereInput[] } | null {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return null;
  }

  const containsQuery = { contains: normalizedQuery };
  const merchantKey = normalizeMerchantKey(normalizedQuery);

  return {
    OR: [
      ...(merchantKey.length > 0
        ? [{ normalizedMerchant: { contains: merchantKey } }]
        : []),
      { merchant: containsQuery },
      { note: containsQuery },
      { category: { is: { name: containsQuery } } },
    ],
  };
}

export async function getTransactionsPage(
  db: TransactionListDbClient,
  filters: TransactionsListFilters,
): Promise<TransactionsListResult> {
  const where: Prisma.TransactionWhereInput = {
    accountId: filters.accountId,
    ...categoryFilterWhere(filters.categoryId ? [filters.categoryId] : []),
  };

  if (filters.dateFrom || filters.dateTo) {
    where.bookingDate = {
      gte: filters.dateFrom,
      lt: filters.dateTo ? addUtcDays(filters.dateTo, 1) : undefined,
    };
  }

  const textWhere = transactionTextWhere(filters.query ?? "");
  if (textWhere) {
    where.OR = textWhere.OR;
  }

  const skip = (filters.page - 1) * filters.pageSize;
  const orderBy = getOrderBy(filters.sorting);

  const total = await db.transaction.count({ where });
  const records = await db.transaction.findMany({
    where,
    select: TRANSACTION_ROW_SELECT,
    orderBy,
    skip,
    take: filters.pageSize,
  });

  return {
    rows: records.map(toTransactionRow),
    pagination: {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    },
  };
}

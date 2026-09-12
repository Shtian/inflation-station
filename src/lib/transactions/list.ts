import type { Prisma } from "@prisma/client";
import {
  TRANSACTION_ROW_SELECT,
  type TransactionRow,
  type TransactionRowRecord,
  toTransactionRow,
} from "./row";

type StringContainsFilter = {
  contains: string;
};

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

export async function getTransactionsPage(
  db: TransactionListDbClient,
  filters: TransactionsListFilters,
): Promise<TransactionsListResult> {
  const where: Prisma.TransactionWhereInput = {
    accountId: filters.accountId,
    categoryId: filters.categoryId,
  };

  if (filters.dateFrom || filters.dateTo) {
    where.bookingDate = {
      gte: filters.dateFrom,
      lt: filters.dateTo ? addUtcDays(filters.dateTo, 1) : undefined,
    };
  }

  const normalizedQuery = filters.query?.trim();
  if (normalizedQuery) {
    const containsQuery: StringContainsFilter = {
      contains: normalizedQuery,
    };

    where.OR = [
      {
        normalizedMerchant: containsQuery,
      },
      {
        merchant: containsQuery,
      },
      {
        note: containsQuery,
      },
      {
        category: {
          is: {
            name: containsQuery,
          },
        },
      },
    ];
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

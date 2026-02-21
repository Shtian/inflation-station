import type { Prisma } from "@prisma/client";

type DecimalLike = { toString(): string } | number;

type StringContainsFilter = {
  contains: string;
  mode: "insensitive";
};

type TransactionListRecord = {
  id: string;
  accountId: string;
  categoryId: string | null;
  category: {
    name: string;
  } | null;
  bookingDate: Date;
  amountNok: DecimalLike;
  currency: string;
  normalizedMerchant: string;
  paymentType: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionListDbClient = {
  transaction: {
    count(args: { where: Prisma.TransactionWhereInput }): Promise<number>;
    findMany(args: {
      where: Prisma.TransactionWhereInput;
      select: {
        id: true;
        accountId: true;
        categoryId: true;
        category: {
          select: {
            name: true;
          };
        };
        bookingDate: true;
        amountNok: true;
        currency: true;
        normalizedMerchant: true;
        paymentType: true;
        note: true;
        createdAt: true;
        updatedAt: true;
      };
      orderBy: Prisma.TransactionOrderByWithRelationInput[];
      skip: number;
      take: number;
    }): Promise<TransactionListRecord[]>;
  };
};

export type TransactionsListFilters = {
  accountId?: string;
  categoryId?: string;
  query?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sorting?: {
    field: "bookingDate" | "amountNok" | "normalizedMerchant" | "category";
    direction: "asc" | "desc";
  };
  page: number;
  pageSize: number;
};

export type TransactionListRow = {
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
  createdAt: string;
  updatedAt: string;
};

export type TransactionsListResult = {
  rows: TransactionListRow[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

function toNumber(value: DecimalLike): number {
  return Number.parseFloat(value.toString());
}

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
    case "normalizedMerchant":
      return [
        { normalizedMerchant: sorting.direction },
        { id: sorting.direction },
      ];
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
      mode: "insensitive",
    };

    where.OR = [
      {
        normalizedMerchant: containsQuery,
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
    select: {
      id: true,
      accountId: true,
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
      paymentType: true,
      note: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy,
    skip,
    take: filters.pageSize,
  });

  const rows = records.map((record) => ({
    id: record.id,
    accountId: record.accountId,
    categoryId: record.categoryId,
    categoryName: record.category?.name ?? null,
    bookingDate: record.bookingDate.toISOString().slice(0, 10),
    amountNok: toNumber(record.amountNok),
    currency: record.currency,
    normalizedMerchant: record.normalizedMerchant,
    paymentType: record.paymentType,
    note: record.note,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));

  return {
    rows,
    pagination: {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    },
  };
}

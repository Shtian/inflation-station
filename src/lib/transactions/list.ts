type DecimalLike = { toString(): string } | number;

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
    count(args: {
      where: {
        accountId?: string;
      };
    }): Promise<number>;
    findMany(args: {
      where: {
        accountId?: string;
      };
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
      orderBy: [{ bookingDate: "desc" }, { id: "desc" }];
      skip: number;
      take: number;
    }): Promise<TransactionListRecord[]>;
  };
};

export type TransactionsListFilters = {
  accountId?: string;
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

export async function getTransactionsPage(
  db: TransactionListDbClient,
  filters: TransactionsListFilters,
): Promise<TransactionsListResult> {
  const where = {
    accountId: filters.accountId,
  };
  const skip = (filters.page - 1) * filters.pageSize;

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
    orderBy: [{ bookingDate: "desc" }, { id: "desc" }],
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

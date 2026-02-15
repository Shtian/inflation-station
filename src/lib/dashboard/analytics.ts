type DecimalLike = { toString(): string } | number;

type DashboardTransactionRecord = {
  id: string;
  bookingDate: Date;
  amountNok: DecimalLike;
  account: {
    id: string;
    name: string;
  };
  category: {
    id: string;
    name: string;
  } | null;
};

type DashboardAnalyticsDbClient = {
  transaction: {
    findMany(args: {
      where: {
        accountId?: string;
        bookingDate?: {
          gte?: Date;
          lte?: Date;
        };
      };
      select: {
        id: true;
        bookingDate: true;
        amountNok: true;
        account: {
          select: {
            id: true;
            name: true;
          };
        };
        category: {
          select: {
            id: true;
            name: true;
          };
        };
      };
      orderBy: [{ bookingDate: "asc" }, { id: "asc" }];
    }): Promise<DashboardTransactionRecord[]>;
  };
};

export type DashboardAnalyticsFilters = {
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
};

export type DateNetCashflowPoint = {
  date: string;
  netNok: number;
};

export type DateInflowOutflowPoint = {
  date: string;
  inflowNok: number;
  outflowNok: number;
};

export type CategorySpendPoint = {
  categoryId: string | null;
  categoryName: string;
  spendNok: number;
  transactionCount: number;
};

export type AccountTrendPoint = {
  date: string;
  netNok: number;
  cumulativeNok: number;
};

export type AccountTrendSeries = {
  accountId: string;
  accountName: string;
  points: AccountTrendPoint[];
};

export type DashboardAnalyticsResult = {
  filters: {
    accountId: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  netCashflow: DateNetCashflowPoint[];
  inflowOutflow: DateInflowOutflowPoint[];
  categoryBreakdown: CategorySpendPoint[];
  accountTrend: AccountTrendSeries[];
};

type MutableDayTotals = {
  netNok: number;
  inflowNok: number;
  outflowNok: number;
};

type MutableCategoryTotals = {
  categoryId: string | null;
  categoryName: string;
  spendNok: number;
  transactionCount: number;
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toNumber(value: DecimalLike): number {
  return Number.parseFloat(value.toString());
}

function applyDateFilter(filters: DashboardAnalyticsFilters) {
  if (!filters.startDate && !filters.endDate) {
    return undefined;
  }

  return {
    gte: filters.startDate,
    lte: filters.endDate,
  };
}

export async function getDashboardAnalytics(
  db: DashboardAnalyticsDbClient,
  filters: DashboardAnalyticsFilters = {},
): Promise<DashboardAnalyticsResult> {
  const where = {
    accountId: filters.accountId,
    bookingDate: applyDateFilter(filters),
  };

  const transactions = await db.transaction.findMany({
    where,
    select: {
      id: true,
      bookingDate: true,
      amountNok: true,
      account: {
        select: {
          id: true,
          name: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ bookingDate: "asc" }, { id: "asc" }],
  });

  const totalsByDate = new Map<string, MutableDayTotals>();
  const spendByCategory = new Map<string, MutableCategoryTotals>();
  const trendByAccount = new Map<string, Map<string, number>>();
  const accountNames = new Map<string, string>();

  for (const transaction of transactions) {
    const dateKey = toDateKey(transaction.bookingDate);
    const amount = toNumber(transaction.amountNok);

    const dayTotals = totalsByDate.get(dateKey) ?? {
      netNok: 0,
      inflowNok: 0,
      outflowNok: 0,
    };
    dayTotals.netNok += amount;
    if (amount >= 0) {
      dayTotals.inflowNok += amount;
    } else {
      dayTotals.outflowNok += Math.abs(amount);
    }
    totalsByDate.set(dateKey, dayTotals);

    if (amount < 0) {
      const categoryId = transaction.category?.id ?? null;
      const categoryName = transaction.category?.name ?? "Uncategorized";
      const categoryKey = categoryId ?? "__uncategorized__";
      const categoryTotals = spendByCategory.get(categoryKey) ?? {
        categoryId,
        categoryName,
        spendNok: 0,
        transactionCount: 0,
      };
      categoryTotals.spendNok += Math.abs(amount);
      categoryTotals.transactionCount += 1;
      spendByCategory.set(categoryKey, categoryTotals);
    }

    accountNames.set(transaction.account.id, transaction.account.name);
    const accountSeries =
      trendByAccount.get(transaction.account.id) ?? new Map();
    accountSeries.set(dateKey, (accountSeries.get(dateKey) ?? 0) + amount);
    trendByAccount.set(transaction.account.id, accountSeries);
  }

  const sortedDates = [...totalsByDate.keys()].sort((a, b) =>
    a.localeCompare(b),
  );
  const netCashflow = sortedDates.map((date) => ({
    date,
    netNok: totalsByDate.get(date)?.netNok ?? 0,
  }));
  const inflowOutflow = sortedDates.map((date) => ({
    date,
    inflowNok: totalsByDate.get(date)?.inflowNok ?? 0,
    outflowNok: totalsByDate.get(date)?.outflowNok ?? 0,
  }));

  const categoryBreakdown = [...spendByCategory.values()].sort((a, b) => {
    if (b.spendNok !== a.spendNok) {
      return b.spendNok - a.spendNok;
    }

    return a.categoryName.localeCompare(b.categoryName);
  });

  const accountTrend = [...trendByAccount.entries()]
    .sort((a, b) => {
      const nameA = accountNames.get(a[0]) ?? "";
      const nameB = accountNames.get(b[0]) ?? "";

      return nameA.localeCompare(nameB) || a[0].localeCompare(b[0]);
    })
    .map(([accountId, totals]) => {
      const points: AccountTrendPoint[] = [];
      let cumulativeNok = 0;
      const dates = [...totals.keys()].sort((a, b) => a.localeCompare(b));

      for (const date of dates) {
        const netNok = totals.get(date) ?? 0;
        cumulativeNok += netNok;
        points.push({
          date,
          netNok,
          cumulativeNok,
        });
      }

      return {
        accountId,
        accountName: accountNames.get(accountId) ?? accountId,
        points,
      };
    });

  return {
    filters: {
      accountId: filters.accountId ?? null,
      startDate: filters.startDate ? toDateKey(filters.startDate) : null,
      endDate: filters.endDate ? toDateKey(filters.endDate) : null,
    },
    netCashflow,
    inflowOutflow,
    categoryBreakdown,
    accountTrend,
  };
}

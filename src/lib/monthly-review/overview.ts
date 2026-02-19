type DecimalLike = { toString(): string } | number;

type MonthlyOverviewTransactionRecord = {
  id: string;
  bookingDate: Date;
  amountNok: DecimalLike;
  category: {
    id: string;
    name: string;
  } | null;
};

type MonthlyOverviewReviewRecord = {
  monthStart: Date;
};

type MonthlyOverviewDbClient = {
  transaction: {
    findMany(args: {
      select: {
        id: true;
        bookingDate: true;
        amountNok: true;
        category: {
          select: {
            id: true;
            name: true;
          };
        };
      };
      orderBy: [{ bookingDate: "asc" }, { id: "asc" }];
    }): Promise<MonthlyOverviewTransactionRecord[]>;
  };
  monthlyReview: {
    findMany(args: {
      select: {
        monthStart: true;
      };
      orderBy: [{ monthStart: "asc" }];
    }): Promise<MonthlyOverviewReviewRecord[]>;
  };
};

export type MonthlyOverviewTopCategory = {
  categoryId: string | null;
  categoryName: string;
  spendNok: number;
};

export type MonthlyOverviewCategorySpend = {
  categoryId: string | null;
  categoryName: string;
  spendNok: number;
};

export type MonthlyOverviewRow = {
  monthStart: string;
  totalSpendNok: number;
  transactionCount: number;
  topCategory: MonthlyOverviewTopCategory | null;
  categorySpendBreakdown: MonthlyOverviewCategorySpend[];
  monthOverMonthSpendDeltaNok: number | null;
};

type MutableCategoryTotal = {
  categoryId: string | null;
  categoryName: string;
  spendNok: number;
};

type MutableMonthTotals = {
  totalSpendNok: number;
  transactionCount: number;
  categoryTotals: Map<string, MutableCategoryTotal>;
};

const UNCATEGORIZED_KEY = "__uncategorized__";
const UNCATEGORIZED_NAME = "Uncategorized";

function toNumber(value: DecimalLike): number {
  return Number.parseFloat(value.toString());
}

function toMonthStartKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");

  return `${year}-${month}-01`;
}

function toPreviousMonthKey(monthStart: string): string {
  const [yearString, monthString] = monthStart.split("-");
  const year = Number.parseInt(yearString, 10);
  const monthIndex = Number.parseInt(monthString, 10) - 1;
  const previousMonthDate = new Date(Date.UTC(year, monthIndex - 1, 1));

  return toMonthStartKey(previousMonthDate);
}

function toTopCategory(
  categoryTotals: Map<string, MutableCategoryTotal>,
): MonthlyOverviewTopCategory | null {
  const ordered = [...categoryTotals.values()].sort((a, b) => {
    if (b.spendNok !== a.spendNok) {
      return b.spendNok - a.spendNok;
    }

    const byName = a.categoryName.localeCompare(b.categoryName);
    if (byName !== 0) {
      return byName;
    }

    return (a.categoryId ?? "").localeCompare(b.categoryId ?? "");
  });

  const winner = ordered[0];
  if (!winner) {
    return null;
  }

  return {
    categoryId: winner.categoryId,
    categoryName: winner.categoryName,
    spendNok: winner.spendNok,
  };
}

function toCategorySpendBreakdown(
  categoryTotals: Map<string, MutableCategoryTotal>,
): MonthlyOverviewCategorySpend[] {
  return [...categoryTotals.values()]
    .sort((a, b) => {
      if (b.spendNok !== a.spendNok) {
        return b.spendNok - a.spendNok;
      }

      const byName = a.categoryName.localeCompare(b.categoryName);
      if (byName !== 0) {
        return byName;
      }

      return (a.categoryId ?? "").localeCompare(b.categoryId ?? "");
    })
    .map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      spendNok: category.spendNok,
    }));
}

export async function getMonthlyOverview(
  db: MonthlyOverviewDbClient,
): Promise<MonthlyOverviewRow[]> {
  const [transactions, reviews] = await Promise.all([
    db.transaction.findMany({
      select: {
        id: true,
        bookingDate: true,
        amountNok: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ bookingDate: "asc" }, { id: "asc" }],
    }),
    db.monthlyReview.findMany({
      select: {
        monthStart: true,
      },
      orderBy: [{ monthStart: "asc" }],
    }),
  ]);

  const totalsByMonth = new Map<string, MutableMonthTotals>();
  const allMonthKeys = new Set<string>();

  for (const review of reviews) {
    allMonthKeys.add(toMonthStartKey(review.monthStart));
  }

  for (const transaction of transactions) {
    const monthKey = toMonthStartKey(transaction.bookingDate);
    allMonthKeys.add(monthKey);

    const amount = toNumber(transaction.amountNok);
    if (amount >= 0) {
      continue;
    }

    const monthTotals = totalsByMonth.get(monthKey) ?? {
      totalSpendNok: 0,
      transactionCount: 0,
      categoryTotals: new Map<string, MutableCategoryTotal>(),
    };

    const spend = Math.abs(amount);
    monthTotals.totalSpendNok += spend;
    monthTotals.transactionCount += 1;

    const categoryKey = transaction.category?.id ?? UNCATEGORIZED_KEY;
    const categoryTotals = monthTotals.categoryTotals.get(categoryKey) ?? {
      categoryId: transaction.category?.id ?? null,
      categoryName: transaction.category?.name ?? UNCATEGORIZED_NAME,
      spendNok: 0,
    };
    categoryTotals.spendNok += spend;
    monthTotals.categoryTotals.set(categoryKey, categoryTotals);

    totalsByMonth.set(monthKey, monthTotals);
  }

  const monthKeys = [...allMonthKeys].sort((a, b) => b.localeCompare(a));

  return monthKeys.map((monthStart) => {
    const totals = totalsByMonth.get(monthStart);
    const previousMonthKey = toPreviousMonthKey(monthStart);
    const previousMonthTotals = totalsByMonth.get(previousMonthKey);

    const totalSpendNok = totals?.totalSpendNok ?? 0;

    return {
      monthStart,
      totalSpendNok,
      transactionCount: totals?.transactionCount ?? 0,
      topCategory: totals ? toTopCategory(totals.categoryTotals) : null,
      categorySpendBreakdown: totals
        ? toCategorySpendBreakdown(totals.categoryTotals)
        : [],
      monthOverMonthSpendDeltaNok: previousMonthTotals
        ? totalSpendNok - previousMonthTotals.totalSpendNok
        : null,
    };
  });
}

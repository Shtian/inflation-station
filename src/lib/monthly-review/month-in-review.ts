import type { MonthlyReviewStatus, PaymentType } from "@prisma/client";
import { isTransfer } from "@/lib/transactions/transfer";
import { toReviewMonthStartDate } from "./review-month-key";
import { type MonthlyTimelineReviewState, toReviewState } from "./timeline";

type DecimalLike = { toString(): string } | number;

export type MonthInReviewTransactionRecord = {
  id: string;
  bookingDate: Date;
  amountNok: DecimalLike;
  normalizedMerchant: string;
  paymentType: PaymentType;
  category: {
    id: string;
    name: string;
    kind: string;
  } | null;
};

type MonthInReviewTransactionFindManyArgs = {
  where: {
    bookingDate: {
      gte: Date;
      lt: Date;
    };
  };
  select: {
    id: true;
    bookingDate: true;
    amountNok: true;
    normalizedMerchant: true;
    paymentType: true;
    category: {
      select: {
        id: true;
        name: true;
        kind: true;
      };
    };
  };
  orderBy: [{ bookingDate: "asc" }, { id: "asc" }];
};

type MonthInReviewDbClient = {
  transaction: {
    findMany(
      args: MonthInReviewTransactionFindManyArgs,
    ): Promise<MonthInReviewTransactionRecord[]>;
  };
};

type NonTransferBookingFilter = {
  OR: [{ categoryId: null }, { category: { kind: { not: "TRANSFER" } } }];
};

type MonthInReviewWithReviewDbClient = {
  transaction: MonthInReviewDbClient["transaction"] & {
    findFirst(args: {
      where: NonTransferBookingFilter & {
        bookingDate: { lt: Date } | { gte: Date };
      };
      select: { bookingDate: true };
      orderBy: { bookingDate: "asc" | "desc" };
    }): Promise<{ bookingDate: Date } | null>;
  };
  monthlyReview: {
    findUnique(args: {
      where: {
        monthStart: Date;
      };
      select: {
        status: true;
        generatedAt: true;
        errorMessage: true;
        reviewText: true;
      };
    }): Promise<{
      status: MonthlyReviewStatus;
      generatedAt: Date | null;
      errorMessage: string | null;
      reviewText: string | null;
    } | null>;
  };
};

export type MonthInReviewCashflow = {
  incomeNok: number;
  spendNok: number;
  netNok: number;
  savingsRate: number | null;
};

export type MonthInReviewCategory = {
  categoryId: string | null;
  categoryName: string;
  spendNok: number;
  share: number;
  transactionCount: number;
  deltaNok: number | null;
};

export type MonthInReviewMerchant = {
  merchant: string;
  spendNok: number;
  share: number;
  transactionCount: number;
};

// EFT is direct debit or eFaktura in this data: mortgage, loans, power,
// insurance. The deck and the AI treat those as fixed and talk about the rest.
export type SpendKind = "bill" | "everyday";

export function toSpendKind(transaction: {
  paymentType: PaymentType;
}): SpendKind {
  return transaction.paymentType === "EFT" ? "bill" : "everyday";
}

export type MonthInReviewBill = {
  merchant: string;
  categoryName: string | null;
  amountNok: number;
};

export type MonthInReviewDay = {
  date: string;
  spendNok: number;
};

export type MonthInReview = {
  monthStart: string;
  cashflow: MonthInReviewCashflow;
  previousMonth: {
    monthStart: string;
    incomeNok: number;
    spendNok: number;
    netNok: number;
  } | null;
  spendTransactionCount: number;
  categories: MonthInReviewCategory[];
  incomeSources: Array<{ source: string; amountNok: number }>;
  bills: {
    totalNok: number;
    count: number;
    items: MonthInReviewBill[];
  };
  everyday: {
    totalNok: number;
    count: number;
    topMerchants: MonthInReviewMerchant[];
    biggestPurchase: {
      bookingDate: string;
      merchant: string;
      amountNok: number;
      categoryName: string | null;
    } | null;
    busiestDay: {
      bookingDate: string;
      spendNok: number;
      transactionCount: number;
    } | null;
    dailySpend: MonthInReviewDay[];
  };
};

export type MonthInReviewWithReview = MonthInReview & {
  adjacentMonths: { previous: string | null; next: string | null };
  reviewState: MonthlyTimelineReviewState;
  generatedAt: string | null;
  errorMessage: string | null;
  reviewText: string | null;
};

export type MonthWindow = {
  monthStart: string;
  monthStartDate: Date;
  nextMonthStartDate: Date;
  previousMonthStartDate: Date;
  reviewMonthStartDate: Date;
};

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}-01$/;
const UNCATEGORIZED_KEY = "__uncategorized__";
const UNCATEGORIZED_NAME = "Uncategorized";
const UNKNOWN_MERCHANT_NAME = "Unknown merchant";
const TOP_MERCHANT_LIMIT = 5;
const INCOME_SOURCE_LIMIT = 3;

function toNumber(value: DecimalLike): number {
  return Number.parseFloat(value.toString());
}

function pad2(value: number): string {
  return `${value}`.padStart(2, "0");
}

function toMonthStartKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-01`;
}

export function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toMerchantName(normalizedMerchant: string): string {
  return normalizedMerchant.trim().length > 0
    ? normalizedMerchant
    : UNKNOWN_MERCHANT_NAME;
}

function toShare(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function toMonthWindow(monthStart: string): MonthWindow {
  if (!MONTH_KEY_PATTERN.test(monthStart)) {
    throw new Error("MONTH_START_INVALID");
  }

  const [yearString, monthString] = monthStart.split("-");
  const year = Number.parseInt(yearString, 10);
  const month = Number.parseInt(monthString, 10);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("MONTH_START_INVALID");
  }

  const monthStartDate = new Date(year, month - 1, 1);

  return {
    monthStart: toMonthStartKey(monthStartDate),
    monthStartDate,
    nextMonthStartDate: new Date(year, month, 1),
    previousMonthStartDate: new Date(year, month - 2, 1),
    reviewMonthStartDate: toReviewMonthStartDate(year, month),
  };
}

type CashflowSplit = {
  incomeNok: number;
  spendNok: number;
  income: MonthInReviewTransactionRecord[];
  spend: MonthInReviewTransactionRecord[];
  spendByKind: Record<SpendKind, MonthInReviewTransactionRecord[]>;
};

function splitCashflow(
  transactions: MonthInReviewTransactionRecord[],
): CashflowSplit {
  const split: CashflowSplit = {
    incomeNok: 0,
    spendNok: 0,
    income: [],
    spend: [],
    spendByKind: { bill: [], everyday: [] },
  };

  for (const transaction of transactions) {
    if (isTransfer(transaction)) {
      continue;
    }

    const amount = toNumber(transaction.amountNok);
    if (amount > 0) {
      split.incomeNok += amount;
      split.income.push(transaction);
    } else if (amount < 0) {
      split.spendNok += Math.abs(amount);
      split.spend.push(transaction);
      split.spendByKind[toSpendKind(transaction)].push(transaction);
    }
  }

  return split;
}

type CategorySpendTotal = Omit<MonthInReviewCategory, "share" | "deltaNok">;

function sumSpendByCategory(
  spend: MonthInReviewTransactionRecord[],
): Map<string, CategorySpendTotal> {
  const totals = new Map<string, CategorySpendTotal>();

  for (const transaction of spend) {
    const key = transaction.category?.id ?? UNCATEGORIZED_KEY;
    const total = totals.get(key) ?? {
      categoryId: transaction.category?.id ?? null,
      categoryName: transaction.category?.name ?? UNCATEGORIZED_NAME,
      spendNok: 0,
      transactionCount: 0,
    };
    total.spendNok += Math.abs(toNumber(transaction.amountNok));
    total.transactionCount += 1;
    totals.set(key, total);
  }

  return totals;
}

function buildCategories(
  spend: MonthInReviewTransactionRecord[],
  spendNok: number,
  previousSpend: MonthInReviewTransactionRecord[] | null,
): MonthInReviewCategory[] {
  const previousTotals = previousSpend
    ? sumSpendByCategory(previousSpend)
    : null;

  return [...sumSpendByCategory(spend).entries()]
    .map(([key, total]) => ({
      categoryId: total.categoryId,
      categoryName: total.categoryName,
      spendNok: total.spendNok,
      share: toShare(total.spendNok, spendNok),
      transactionCount: total.transactionCount,
      deltaNok: previousTotals
        ? total.spendNok - (previousTotals.get(key)?.spendNok ?? 0)
        : null,
    }))
    .sort(
      (a, b) =>
        b.spendNok - a.spendNok ||
        a.categoryName.localeCompare(b.categoryName) ||
        (a.categoryId ?? "").localeCompare(b.categoryId ?? ""),
    );
}

function buildTopMerchants(
  spend: MonthInReviewTransactionRecord[],
  spendNok: number,
): MonthInReviewMerchant[] {
  const totals = new Map<string, { spendNok: number; count: number }>();

  for (const transaction of spend) {
    const merchant = toMerchantName(transaction.normalizedMerchant);
    const total = totals.get(merchant) ?? { spendNok: 0, count: 0 };
    total.spendNok += Math.abs(toNumber(transaction.amountNok));
    total.count += 1;
    totals.set(merchant, total);
  }

  return [...totals.entries()]
    .map(([merchant, total]) => ({
      merchant,
      spendNok: total.spendNok,
      share: toShare(total.spendNok, spendNok),
      transactionCount: total.count,
    }))
    .sort(
      (a, b) => b.spendNok - a.spendNok || a.merchant.localeCompare(b.merchant),
    )
    .slice(0, TOP_MERCHANT_LIMIT);
}

function sumSpend(spend: MonthInReviewTransactionRecord[]): number {
  return spend.reduce(
    (total, transaction) => total + Math.abs(toNumber(transaction.amountNok)),
    0,
  );
}

function buildBills(
  bills: MonthInReviewTransactionRecord[],
): MonthInReview["bills"] {
  return {
    totalNok: sumSpend(bills),
    count: bills.length,
    items: bills
      .map((transaction) => ({
        merchant: toMerchantName(transaction.normalizedMerchant),
        categoryName: transaction.category?.name ?? null,
        amountNok: Math.abs(toNumber(transaction.amountNok)),
      }))
      .sort(
        (a, b) =>
          b.amountNok - a.amountNok || a.merchant.localeCompare(b.merchant),
      ),
  };
}

function buildDailySpend(
  spend: MonthInReviewTransactionRecord[],
  window: MonthWindow,
): MonthInReviewDay[] {
  const spendByDate = new Map<string, number>();
  for (const transaction of spend) {
    const date = toLocalIsoDate(transaction.bookingDate);
    spendByDate.set(
      date,
      (spendByDate.get(date) ?? 0) + Math.abs(toNumber(transaction.amountNok)),
    );
  }

  const days: MonthInReviewDay[] = [];
  for (
    const day = new Date(window.monthStartDate);
    day < window.nextMonthStartDate;
    day.setDate(day.getDate() + 1)
  ) {
    const date = toLocalIsoDate(day);
    days.push({ date, spendNok: spendByDate.get(date) ?? 0 });
  }

  return days;
}

function buildEveryday(
  everyday: MonthInReviewTransactionRecord[],
  window: MonthWindow,
): MonthInReview["everyday"] {
  const totalNok = sumSpend(everyday);

  return {
    totalNok,
    count: everyday.length,
    topMerchants: buildTopMerchants(everyday, totalNok),
    biggestPurchase: buildBiggestPurchase(everyday),
    busiestDay: buildBusiestDay(everyday),
    dailySpend: buildDailySpend(everyday, window),
  };
}

function buildIncomeSources(
  income: MonthInReviewTransactionRecord[],
): MonthInReview["incomeSources"] {
  const totals = new Map<string, number>();

  for (const transaction of income) {
    const source = toMerchantName(transaction.normalizedMerchant);
    totals.set(
      source,
      (totals.get(source) ?? 0) + toNumber(transaction.amountNok),
    );
  }

  return [...totals.entries()]
    .map(([source, amountNok]) => ({ source, amountNok }))
    .sort(
      (a, b) => b.amountNok - a.amountNok || a.source.localeCompare(b.source),
    )
    .slice(0, INCOME_SOURCE_LIMIT);
}

function buildBiggestPurchase(
  spend: MonthInReviewTransactionRecord[],
): MonthInReview["everyday"]["biggestPurchase"] {
  let biggest: MonthInReviewTransactionRecord | null = null;

  for (const transaction of spend) {
    if (
      !biggest ||
      Math.abs(toNumber(transaction.amountNok)) >
        Math.abs(toNumber(biggest.amountNok))
    ) {
      biggest = transaction;
    }
  }

  if (!biggest) {
    return null;
  }

  return {
    bookingDate: toLocalIsoDate(biggest.bookingDate),
    merchant: toMerchantName(biggest.normalizedMerchant),
    amountNok: Math.abs(toNumber(biggest.amountNok)),
    categoryName: biggest.category?.name ?? null,
  };
}

function buildBusiestDay(
  spend: MonthInReviewTransactionRecord[],
): MonthInReview["everyday"]["busiestDay"] {
  const days = new Map<
    string,
    { spendNok: number; transactionCount: number }
  >();

  for (const transaction of spend) {
    const bookingDate = toLocalIsoDate(transaction.bookingDate);
    const day = days.get(bookingDate) ?? { spendNok: 0, transactionCount: 0 };
    day.spendNok += Math.abs(toNumber(transaction.amountNok));
    day.transactionCount += 1;
    days.set(bookingDate, day);
  }

  const [busiest] = [...days.entries()]
    .map(([bookingDate, day]) => ({ bookingDate, ...day }))
    .sort(
      (a, b) =>
        b.transactionCount - a.transactionCount ||
        b.spendNok - a.spendNok ||
        a.bookingDate.localeCompare(b.bookingDate),
    );

  return busiest ?? null;
}

export function buildMonthInReview(params: {
  monthStart: string;
  monthTransactions: MonthInReviewTransactionRecord[];
  previousMonthTransactions: MonthInReviewTransactionRecord[];
}): MonthInReview {
  const window = toMonthWindow(params.monthStart);
  const current = splitCashflow(params.monthTransactions);
  const previous =
    params.previousMonthTransactions.length > 0
      ? splitCashflow(params.previousMonthTransactions)
      : null;
  const netNok = current.incomeNok - current.spendNok;

  return {
    monthStart: window.monthStart,
    cashflow: {
      incomeNok: current.incomeNok,
      spendNok: current.spendNok,
      netNok,
      savingsRate: current.incomeNok > 0 ? netNok / current.incomeNok : null,
    },
    previousMonth: previous
      ? {
          monthStart: toMonthStartKey(window.previousMonthStartDate),
          incomeNok: previous.incomeNok,
          spendNok: previous.spendNok,
          netNok: previous.incomeNok - previous.spendNok,
        }
      : null,
    spendTransactionCount: current.spend.length,
    categories: buildCategories(
      current.spend,
      current.spendNok,
      previous?.spend ?? null,
    ),
    incomeSources: buildIncomeSources(current.income),
    bills: buildBills(current.spendByKind.bill),
    everyday: buildEveryday(current.spendByKind.everyday, window),
  };
}

function findMonthTransactions(
  db: MonthInReviewDbClient,
  gte: Date,
  lt: Date,
): Promise<MonthInReviewTransactionRecord[]> {
  return db.transaction.findMany({
    where: { bookingDate: { gte, lt } },
    select: {
      id: true,
      bookingDate: true,
      amountNok: true,
      normalizedMerchant: true,
      paymentType: true,
      category: {
        select: {
          id: true,
          name: true,
          kind: true,
        },
      },
    },
    orderBy: [{ bookingDate: "asc" }, { id: "asc" }],
  });
}

export async function getMonthInReview(
  db: MonthInReviewDbClient,
  params: { monthStart: string },
): Promise<MonthInReview> {
  const window = toMonthWindow(params.monthStart);
  const [monthTransactions, previousMonthTransactions] = await Promise.all([
    findMonthTransactions(db, window.monthStartDate, window.nextMonthStartDate),
    findMonthTransactions(
      db,
      window.previousMonthStartDate,
      window.monthStartDate,
    ),
  ]);

  return buildMonthInReview({
    monthStart: window.monthStart,
    monthTransactions,
    previousMonthTransactions,
  });
}

const NON_TRANSFER_BOOKING: NonTransferBookingFilter = {
  OR: [{ categoryId: null }, { category: { kind: { not: "TRANSFER" } } }],
};

async function findAdjacentMonths(
  db: MonthInReviewWithReviewDbClient,
  window: MonthWindow,
): Promise<MonthInReviewWithReview["adjacentMonths"]> {
  const [previous, next] = await Promise.all([
    db.transaction.findFirst({
      where: {
        ...NON_TRANSFER_BOOKING,
        bookingDate: { lt: window.monthStartDate },
      },
      select: { bookingDate: true },
      orderBy: { bookingDate: "desc" },
    }),
    db.transaction.findFirst({
      where: {
        ...NON_TRANSFER_BOOKING,
        bookingDate: { gte: window.nextMonthStartDate },
      },
      select: { bookingDate: true },
      orderBy: { bookingDate: "asc" },
    }),
  ]);

  return {
    previous: previous ? toMonthStartKey(previous.bookingDate) : null,
    next: next ? toMonthStartKey(next.bookingDate) : null,
  };
}

export async function getMonthInReviewWithReview(
  db: MonthInReviewWithReviewDbClient,
  params: { monthStart: string },
): Promise<MonthInReviewWithReview> {
  const window = toMonthWindow(params.monthStart);
  const [facts, adjacentMonths, review] = await Promise.all([
    getMonthInReview(db, { monthStart: window.monthStart }),
    findAdjacentMonths(db, window),
    db.monthlyReview.findUnique({
      where: { monthStart: window.reviewMonthStartDate },
      select: {
        status: true,
        generatedAt: true,
        errorMessage: true,
        reviewText: true,
      },
    }),
  ]);

  return {
    ...facts,
    adjacentMonths,
    reviewState: toReviewState(review?.status ?? null),
    generatedAt: review?.generatedAt?.toISOString() ?? null,
    errorMessage: review?.errorMessage ?? null,
    reviewText: review?.reviewText ?? null,
  };
}

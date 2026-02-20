import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import type { PaymentType } from "@prisma/client";
import { getMonthlyReviewSystemPrompt } from "./system-prompt";

type DecimalLike = { toString(): string } | number;

type MonthlyReviewGenerationTransactionRecord = {
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

type MonthlyReviewGenerationDbClient = {
  transaction: {
    findMany(args: {
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
    }): Promise<MonthlyReviewGenerationTransactionRecord[]>;
  };
  monthlyReviewSystemPrompt: {
    findUnique(args: {
      where: {
        id: string;
      };
      select: {
        promptText: true;
        modelId: true;
      };
    }): Promise<{ promptText: string | null; modelId: string | null } | null>;
  };
};

export type MonthlyReviewGenerationTransaction = {
  bookingDate: string;
  amountNok: number;
  normalizedMerchant: string;
  paymentType: PaymentType;
  categoryName: string | null;
};

export type MonthlyReviewCategoryTotal = {
  categoryId: string | null;
  categoryName: string;
  spendNok: number;
  spendShare: number;
  transactionCount: number;
};

export type MonthlyReviewMerchantTotal = {
  normalizedMerchant: string;
  spendNok: number;
  spendShare: number;
  transactionCount: number;
};

export type MonthlyReviewGenerationMetrics = {
  monthlyTotals: {
    totalSpendNok: number;
    spendTransactionCount: number;
  };
  categoryTotals: MonthlyReviewCategoryTotal[];
  merchantConcentration: {
    topMerchants: MonthlyReviewMerchantTotal[];
    top3SpendShare: number;
    top5SpendShare: number;
    uniqueMerchantCount: number;
  };
  monthOverMonth: {
    previousMonthStart: string;
    previousMonthTotalSpendNok: number;
    spendDeltaNok: number;
    spendDeltaPercent: number | null;
  } | null;
};

export type MonthlyReviewGenerationInput = {
  monthStart: string;
  systemPrompt: string;
  usesDefaultPrompt: boolean;
  modelId: OpenAIChatModelId;
  usesDefaultModel: boolean;
  metrics: MonthlyReviewGenerationMetrics;
  transactions: MonthlyReviewGenerationTransaction[];
};

type MutableCategoryTotal = {
  categoryId: string | null;
  categoryName: string;
  spendNok: number;
  transactionCount: number;
};

type MutableMerchantTotal = {
  normalizedMerchant: string;
  spendNok: number;
  transactionCount: number;
};

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}-01$/;
const UNCATEGORIZED_NAME = "Uncategorized";
const UNKNOWN_MERCHANT_NAME = "Unknown merchant";
const TRANSFER_CATEGORY_KIND = "TRANSFER";

function toNumber(value: DecimalLike): number {
  return Number.parseFloat(value.toString());
}

function toMonthStartDate(monthStart: string): Date {
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

  return new Date(Date.UTC(year, month - 1, 1));
}

function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

function toMonthStartKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}-01`;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toSpendTransactions(
  transactions: MonthlyReviewGenerationTransactionRecord[],
) {
  return transactions.filter(
    (transaction) =>
      toNumber(transaction.amountNok) < 0 &&
      transaction.category?.kind !== TRANSFER_CATEGORY_KIND,
  );
}

function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function buildCategoryTotals(
  transactions: MonthlyReviewGenerationTransactionRecord[],
  totalSpendNok: number,
): MonthlyReviewCategoryTotal[] {
  const totals = new Map<string, MutableCategoryTotal>();

  for (const transaction of transactions) {
    const spendNok = Math.abs(toNumber(transaction.amountNok));
    const key = transaction.category?.id ?? "__uncategorized__";
    const existing = totals.get(key) ?? {
      categoryId: transaction.category?.id ?? null,
      categoryName: transaction.category?.name ?? UNCATEGORIZED_NAME,
      spendNok: 0,
      transactionCount: 0,
    };

    existing.spendNok += spendNok;
    existing.transactionCount += 1;
    totals.set(key, existing);
  }

  return [...totals.values()]
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
    .map((total) => ({
      categoryId: total.categoryId,
      categoryName: total.categoryName,
      spendNok: total.spendNok,
      spendShare: toPercent(total.spendNok, totalSpendNok),
      transactionCount: total.transactionCount,
    }));
}

function buildMerchantTotals(
  transactions: MonthlyReviewGenerationTransactionRecord[],
  totalSpendNok: number,
): MonthlyReviewMerchantTotal[] {
  const totals = new Map<string, MutableMerchantTotal>();

  for (const transaction of transactions) {
    const merchant =
      transaction.normalizedMerchant.trim().length > 0
        ? transaction.normalizedMerchant
        : UNKNOWN_MERCHANT_NAME;
    const existing = totals.get(merchant) ?? {
      normalizedMerchant: merchant,
      spendNok: 0,
      transactionCount: 0,
    };

    existing.spendNok += Math.abs(toNumber(transaction.amountNok));
    existing.transactionCount += 1;
    totals.set(merchant, existing);
  }

  return [...totals.values()]
    .sort((a, b) => {
      if (b.spendNok !== a.spendNok) {
        return b.spendNok - a.spendNok;
      }

      return a.normalizedMerchant.localeCompare(b.normalizedMerchant);
    })
    .map((total) => ({
      normalizedMerchant: total.normalizedMerchant,
      spendNok: total.spendNok,
      spendShare: toPercent(total.spendNok, totalSpendNok),
      transactionCount: total.transactionCount,
    }));
}

export async function buildMonthlyReviewGenerationInput(
  db: MonthlyReviewGenerationDbClient,
  params: {
    monthStart: string;
  },
): Promise<MonthlyReviewGenerationInput> {
  const monthStartDate = toMonthStartDate(params.monthStart);
  const nextMonthStartDate = addMonths(monthStartDate, 1);
  const previousMonthStartDate = addMonths(monthStartDate, -1);

  const [promptResult, monthTransactions, previousMonthTransactions] =
    await Promise.all([
      getMonthlyReviewSystemPrompt(db),
      db.transaction.findMany({
        where: {
          bookingDate: {
            gte: monthStartDate,
            lt: nextMonthStartDate,
          },
        },
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
      }),
      db.transaction.findMany({
        where: {
          bookingDate: {
            gte: previousMonthStartDate,
            lt: monthStartDate,
          },
        },
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
      }),
    ]);

  const spendTransactions = toSpendTransactions(monthTransactions);
  const previousMonthSpendTransactions = toSpendTransactions(
    previousMonthTransactions,
  );

  const totalSpendNok = spendTransactions.reduce(
    (sum, transaction) => sum + Math.abs(toNumber(transaction.amountNok)),
    0,
  );
  const previousMonthTotalSpendNok = previousMonthSpendTransactions.reduce(
    (sum, transaction) => sum + Math.abs(toNumber(transaction.amountNok)),
    0,
  );
  const spendDeltaNok = totalSpendNok - previousMonthTotalSpendNok;

  const categoryTotals = buildCategoryTotals(spendTransactions, totalSpendNok);
  const merchantTotals = buildMerchantTotals(spendTransactions, totalSpendNok);

  return {
    monthStart: toMonthStartKey(monthStartDate),
    systemPrompt: promptResult.prompt,
    usesDefaultPrompt: promptResult.isDefault,
    modelId: promptResult.modelId,
    usesDefaultModel: promptResult.isDefaultModel,
    metrics: {
      monthlyTotals: {
        totalSpendNok,
        spendTransactionCount: spendTransactions.length,
      },
      categoryTotals,
      merchantConcentration: {
        topMerchants: merchantTotals.slice(0, 5),
        top3SpendShare: merchantTotals
          .slice(0, 3)
          .reduce((sum, merchant) => sum + merchant.spendShare, 0),
        top5SpendShare: merchantTotals
          .slice(0, 5)
          .reduce((sum, merchant) => sum + merchant.spendShare, 0),
        uniqueMerchantCount: merchantTotals.length,
      },
      monthOverMonth:
        previousMonthTransactions.length > 0
          ? {
              previousMonthStart: toMonthStartKey(previousMonthStartDate),
              previousMonthTotalSpendNok,
              spendDeltaNok,
              spendDeltaPercent:
                previousMonthTotalSpendNok > 0
                  ? spendDeltaNok / previousMonthTotalSpendNok
                  : null,
            }
          : null,
    },
    transactions: monthTransactions.map((transaction) => ({
      bookingDate: toIsoDate(transaction.bookingDate),
      amountNok: toNumber(transaction.amountNok),
      normalizedMerchant: transaction.normalizedMerchant,
      paymentType: transaction.paymentType,
      categoryName: transaction.category?.name ?? null,
    })),
  };
}

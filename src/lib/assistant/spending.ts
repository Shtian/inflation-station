import type { Prisma, PrismaClient } from "@prisma/client";
import { toLocalIsoDate } from "@/lib/monthly-review/month-in-review";
import { normalizeMerchantKey } from "@/lib/transactions/merchant";
import { isTransfer } from "@/lib/transactions/transfer";
import { toLocalDayBounds } from "./local-day";

export type SpendGroupBy = "category" | "merchant" | "month" | "account";

export type SpendingSummary = {
  range: { from: string; to: string };
  filters: {
    categoryIds: string[];
    accountIds: string[];
    merchantQuery: string | null;
  };
  groupBy: SpendGroupBy;
  totalSpendNok: number;
  transactionCount: number;
  groups: Array<{
    key: string | null;
    label: string;
    spendNok: number;
    transactionCount: number;
  }>;
};

export type SummarizeSpendingInput = {
  from: string;
  to: string;
  groupBy: SpendGroupBy;
  categoryIds?: string[];
  accountIds?: string[];
  merchantQuery?: string;
};

const SPEND_TRANSACTION_SELECT = {
  bookingDate: true,
  amountNok: true,
  normalizedMerchant: true,
  account: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, kind: true } },
} satisfies Prisma.TransactionSelect;

type SpendTransaction = Prisma.TransactionGetPayload<{
  select: typeof SPEND_TRANSACTION_SELECT;
}>;

const UNCATEGORIZED_LABEL = "Ukategorisert";
const UNKNOWN_MERCHANT_LABEL = "Ukjent brukersted";

const SPEND_GROUPERS: Record<
  SpendGroupBy,
  (transaction: SpendTransaction) => { key: string | null; label: string }
> = {
  category: ({ category }) =>
    category
      ? { key: category.id, label: category.name }
      : { key: null, label: UNCATEGORIZED_LABEL },
  merchant: ({ normalizedMerchant }) =>
    normalizedMerchant.trim().length > 0
      ? { key: normalizedMerchant, label: normalizedMerchant }
      : { key: null, label: UNKNOWN_MERCHANT_LABEL },
  month: ({ bookingDate }) => {
    const month = toLocalIsoDate(bookingDate).slice(0, 7);
    return { key: month, label: month };
  },
  account: ({ account }) => ({ key: account.id, label: account.name }),
};

function roundNok(value: number): number {
  return Math.round(value * 100) / 100;
}

function merchantMatch(query: string): Prisma.TransactionWhereInput {
  const merchantKey = normalizeMerchantKey(query);
  return {
    OR: [
      ...(merchantKey.length > 0
        ? [{ normalizedMerchant: { contains: merchantKey } }]
        : []),
      { merchant: { contains: query } },
    ],
  };
}

export async function summarizeSpending(
  db: PrismaClient,
  input: SummarizeSpendingInput,
): Promise<SpendingSummary> {
  const categoryIds = input.categoryIds ?? [];
  const accountIds = input.accountIds ?? [];
  const merchantQuery = input.merchantQuery?.trim() || null;

  const { start, end } = toLocalDayBounds(input);
  const transactions = await db.transaction.findMany({
    where: {
      bookingDate: { gte: start, lt: end },
      ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
      ...(accountIds.length > 0 ? { accountId: { in: accountIds } } : {}),
      ...(merchantQuery ? merchantMatch(merchantQuery) : {}),
    },
    select: SPEND_TRANSACTION_SELECT,
  });

  const toGroup = SPEND_GROUPERS[input.groupBy];
  const groups = new Map<
    string | null,
    {
      key: string | null;
      label: string;
      spendNok: number;
      transactionCount: number;
    }
  >();
  let totalSpendNok = 0;
  let transactionCount = 0;

  for (const transaction of transactions) {
    const amountNok = Number(transaction.amountNok);
    if (isTransfer(transaction) || amountNok >= 0) {
      continue;
    }
    const spendNok = Math.abs(amountNok);
    const { key, label } = toGroup(transaction);
    const group = groups.get(key) ?? {
      key,
      label,
      spendNok: 0,
      transactionCount: 0,
    };
    group.spendNok += spendNok;
    group.transactionCount += 1;
    groups.set(key, group);
    totalSpendNok += spendNok;
    transactionCount += 1;
  }

  return {
    range: { from: input.from, to: input.to },
    filters: { categoryIds, accountIds, merchantQuery },
    groupBy: input.groupBy,
    totalSpendNok: roundNok(totalSpendNok),
    transactionCount,
    groups: [...groups.values()]
      .map((group) => ({ ...group, spendNok: roundNok(group.spendNok) }))
      .sort(
        (a, b) =>
          b.spendNok - a.spendNok || a.label.localeCompare(b.label, "nb"),
      ),
  };
}

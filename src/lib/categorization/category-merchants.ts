import type { PrismaClient } from "@prisma/client";
import { normalizeMerchantKey } from "@/lib/transactions/merchant";
import {
  INTERMEDIARY_PREFIXES,
  LEGAL_SUFFIXES,
  toMerchantFamilyKey,
} from "./merchant-family";

export type HistoryMerchant = {
  key: string;
  label: string;
  transactionCount: number;
};

export type CategoryMerchantHistory = {
  transactionCount: number;
  merchants: HistoryMerchant[];
};

export type MerchantUsageRow = {
  normalizedMerchant: string;
  merchant: string | null;
  count: number;
};

export type CategoryMerchantsDb = Pick<
  PrismaClient,
  "category" | "transaction"
>;

export const MAX_HISTORY_MERCHANTS = 50;
const MAX_LABEL_WORDS = 2;

export async function getCategoryMerchantHistory(
  db: CategoryMerchantsDb,
  categoryId: string,
): Promise<CategoryMerchantHistory | null> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    return null;
  }

  const grouped = await db.transaction.groupBy({
    by: ["normalizedMerchant", "merchant"],
    where: { categoryId },
    _count: { _all: true },
  });
  const rows = grouped.map((group) => ({
    normalizedMerchant: group.normalizedMerchant,
    merchant: group.merchant,
    count: group._count._all,
  }));

  return {
    transactionCount: rows.reduce((total, row) => total + row.count, 0),
    merchants: aggregateMerchantFamilies(rows),
  };
}

export function aggregateMerchantFamilies(
  rows: readonly MerchantUsageRow[],
): HistoryMerchant[] {
  const families = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key =
      toMerchantFamilyKey(row.normalizedMerchant) ??
      normalizeMerchantKey(row.normalizedMerchant);
    if (key.length === 0) {
      continue;
    }
    const displayCounts = families.get(key) ?? new Map<string, number>();
    const display = row.merchant ?? row.normalizedMerchant;
    displayCounts.set(display, (displayCounts.get(display) ?? 0) + row.count);
    families.set(key, displayCounts);
  }

  const merchants: HistoryMerchant[] = [];
  for (const [key, displayCounts] of families) {
    merchants.push({
      key,
      label: labelForFamily(displayCounts),
      transactionCount: [...displayCounts.values()].reduce(
        (total, count) => total + count,
        0,
      ),
    });
  }

  return merchants
    .sort(
      (a, b) =>
        b.transactionCount - a.transactionCount ||
        compareText(a.label, b.label),
    )
    .slice(0, MAX_HISTORY_MERCHANTS);
}

export function labelForFamily(
  displayCounts: ReadonlyMap<string, number>,
): string {
  const displayNames = [...displayCounts]
    .sort(
      ([nameA, countA], [nameB, countB]) =>
        countB - countA || compareText(nameA, nameB),
    )
    .map(([name]) => name);
  const wordLists = displayNames.map(dropLeadingIntermediaries);
  const [first = []] = wordLists;

  const label: string[] = [];
  for (const [index, word] of first.entries()) {
    const key = normalizeMerchantKey(word);
    if (
      label.length === MAX_LABEL_WORDS ||
      key.length === 0 ||
      /\d/.test(key) ||
      LEGAL_SUFFIXES.has(key) ||
      INTERMEDIARY_PREFIXES.has(key) ||
      wordLists.some(
        (words) => normalizeMerchantKey(words[index] ?? "") !== key,
      )
    ) {
      break;
    }
    label.push(displayCase(word));
  }
  if (label.length > 0) {
    return label.join(" ");
  }

  const mostCommon = displayNames[0] ?? "";
  const fallback = splitWords(mostCommon).find(
    (word) => normalizeMerchantKey(word).length > 0 && !/\d/.test(word),
  );
  return fallback ? titleCase(fallback) : mostCommon.trim();
}

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}

function dropLeadingIntermediaries(displayName: string): string[] {
  const words = splitWords(displayName);
  const start = words.findIndex((word) => {
    const key = normalizeMerchantKey(word);
    return key.length > 0 && !INTERMEDIARY_PREFIXES.has(key);
  });
  return start === -1 ? [] : words.slice(start);
}

function displayCase(word: string): string {
  const isAllCaps = word === word.toUpperCase() && word !== word.toLowerCase();
  return isAllCaps ? titleCase(word) : word;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

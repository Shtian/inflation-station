import { normalizeMerchantKey } from "@/lib/transactions/merchant";

export type HistoryLookupRow = {
  rowNumber: number;
  normalizedMerchant: string;
};

export type CategorizedHistoryEntry = {
  normalizedMerchant: string;
  categoryId: string;
};

export type HistorySuggestion = {
  rowNumber: number;
  categoryId: string;
  confidence: number;
};

type CategoryCounts = Map<string, number>;
type HistoryIndex = Map<string, CategoryCounts>;

// "apple com bill" (subscriptions billed by apple.com) and "apple store oslo"
// (a shop) are different merchants, so a domain suffix stays part of the brand.
const DOMAIN_SUFFIXES = new Set(["com", "no", "net", "org", "io", "se", "dk"]);

// Payment processors and card labels prefix the real merchant, so keying on
// them would give every Vipps or PayPal purchase one shared category.
const INTERMEDIARY_PREFIXES = new Set([
  "vipps",
  "paypal",
  "klarna",
  "sumup",
  "zettle",
  "izettle",
  "visa",
  "mastercard",
  "varekjop",
  "kortkjop",
  "bankaxept",
]);

// Imported merchants are name + title, so they carry store numbers, dates and
// city names around the brand. The family key keeps the first word without
// digits after any intermediary prefix, which is the brand for the statement
// formats we import.
function toMerchantFamilyKey(normalizedMerchant: string): string | null {
  const tokens = normalizeMerchantKey(normalizedMerchant).split(" ");
  const brandIndex = tokens.findIndex(
    (token) =>
      token.length > 0 &&
      !/\d/.test(token) &&
      !INTERMEDIARY_PREFIXES.has(token),
  );
  if (brandIndex === -1) {
    return null;
  }

  const brand = tokens[brandIndex];
  const next = tokens[brandIndex + 1];
  return next !== undefined && DOMAIN_SUFFIXES.has(next)
    ? `${brand}.${next}`
    : brand;
}

function addToIndex(index: HistoryIndex, key: string, categoryId: string) {
  const counts = index.get(key) ?? new Map<string, number>();
  counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  index.set(key, counts);
}

function pickMajority(
  counts: CategoryCounts,
): { categoryId: string; confidence: number } | null {
  let total = 0;
  let winner: { categoryId: string; count: number } | null = null;
  for (const [categoryId, count] of counts) {
    total += count;
    if (winner === null || count > winner.count) {
      winner = { categoryId, count };
    }
  }

  if (winner === null || winner.count / total <= 0.5) {
    return null;
  }
  return { categoryId: winner.categoryId, confidence: winner.count / total };
}

export function suggestCategoriesFromHistory(
  rows: HistoryLookupRow[],
  history: CategorizedHistoryEntry[],
): HistorySuggestion[] {
  const exactIndex: HistoryIndex = new Map();
  const familyIndex: HistoryIndex = new Map();
  for (const entry of history) {
    addToIndex(exactIndex, entry.normalizedMerchant, entry.categoryId);
    const familyKey = toMerchantFamilyKey(entry.normalizedMerchant);
    if (familyKey !== null) {
      addToIndex(familyIndex, familyKey, entry.categoryId);
    }
  }

  const suggestions: HistorySuggestion[] = [];
  for (const row of rows) {
    const familyKey = toMerchantFamilyKey(row.normalizedMerchant);
    // A merchant with its own history is decided by that history alone, so a
    // merchant the user splits across categories falls through to Jev.
    const counts =
      exactIndex.get(row.normalizedMerchant) ??
      (familyKey === null ? undefined : familyIndex.get(familyKey));
    const majority = counts === undefined ? null : pickMajority(counts);
    if (majority !== null) {
      suggestions.push({ rowNumber: row.rowNumber, ...majority });
    }
  }
  return suggestions;
}

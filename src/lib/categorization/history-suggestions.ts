import { normalizeMerchantKey } from "@/lib/transactions/merchant";

export type HistoryLookupRow = {
  rowNumber: number;
  normalizedMerchant: string;
  amountNok: number;
};

export type CategorizedHistoryEntry = {
  normalizedMerchant: string;
  amountNok: number;
  categoryId: string;
};

export type HistorySuggestion = {
  rowNumber: number;
  categoryId: string;
  confidence: number;
};

type CategoryCounts = Map<string, number>;
type HistoryIndex = Map<string, CategoryCounts>;

// One past transaction at an exact merchant is enough, but a looser family
// match ("norsk tipping" vs "norsk arbeidsgiver as") needs repeat evidence.
const MIN_EXACT_SUPPORT = 1;
const MIN_FAMILY_SUPPORT = 2;
const MIN_FAMILY_KEY_LENGTH = 3;

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
  "iz",
  "sq",
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
  const brand = tokens[brandIndex];
  if (brand === undefined || brand.length < MIN_FAMILY_KEY_LENGTH) {
    return null;
  }

  const next = tokens[brandIndex + 1];
  return next !== undefined && DOMAIN_SUFFIXES.has(next)
    ? `${brand}.${next}`
    : brand;
}

// Income and expenses never share a suggestion, so every index key carries
// the money direction.
function toDirectedKey(amountNok: number, merchantKey: string): string {
  return `${amountNok < 0 ? "out" : "in"}:${merchantKey}`;
}

function addToIndex(index: HistoryIndex, key: string, categoryId: string) {
  const counts = index.get(key) ?? new Map<string, number>();
  counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  index.set(key, counts);
}

function pickMajority(
  counts: CategoryCounts,
  minSupport: number,
): { categoryId: string; confidence: number } | null {
  let total = 0;
  let winner: { categoryId: string; count: number } | null = null;
  for (const [categoryId, count] of counts) {
    total += count;
    if (winner === null || count > winner.count) {
      winner = { categoryId, count };
    }
  }

  if (
    winner === null ||
    winner.count < minSupport ||
    winner.count / total <= 0.5
  ) {
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
    addToIndex(
      exactIndex,
      toDirectedKey(entry.amountNok, entry.normalizedMerchant),
      entry.categoryId,
    );
    const familyKey = toMerchantFamilyKey(entry.normalizedMerchant);
    if (familyKey !== null) {
      addToIndex(
        familyIndex,
        toDirectedKey(entry.amountNok, familyKey),
        entry.categoryId,
      );
    }
  }

  const suggestions: HistorySuggestion[] = [];
  for (const row of rows) {
    const familyKey = toMerchantFamilyKey(row.normalizedMerchant);
    // A merchant with its own history is decided by that history alone, so a
    // merchant the user splits across categories falls through to Jev.
    const exactCounts = exactIndex.get(
      toDirectedKey(row.amountNok, row.normalizedMerchant),
    );
    const familyCounts =
      familyKey === null
        ? undefined
        : familyIndex.get(toDirectedKey(row.amountNok, familyKey));
    const majority =
      exactCounts !== undefined
        ? pickMajority(exactCounts, MIN_EXACT_SUPPORT)
        : familyCounts !== undefined
          ? pickMajority(familyCounts, MIN_FAMILY_SUPPORT)
          : null;
    if (majority !== null) {
      suggestions.push({ rowNumber: row.rowNumber, ...majority });
    }
  }
  return suggestions;
}

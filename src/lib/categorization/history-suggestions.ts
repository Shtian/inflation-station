import { toMerchantFamilyKey } from "./merchant-family";

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

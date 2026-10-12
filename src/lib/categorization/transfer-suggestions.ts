export type TransferLookupRow = {
  rowNumber: number;
  amountNok: number;
  bookingDate: Date;
};

export type OtherAccountTransaction = {
  amountNok: number;
  bookingDate: Date;
  categoryId: string | null;
};

export type TransferSuggestion = {
  rowNumber: number;
  categoryId: string;
  confidence: number;
};

type TransferCandidate = {
  amountOre: number;
  bookingTime: number;
  transferCategoryId: string;
};

export const TRANSFER_MATCH_MAX_DAYS_APART = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DISTANCE_MS = TRANSFER_MATCH_MAX_DAYS_APART * DAY_MS;
const TRANSFER_MATCH_CONFIDENCE = 0.9;

function toOre(amountNok: number): number {
  return Math.round(amountNok * 100);
}

// A transaction the user filed under a non-transfer category is their word
// that it is not a transfer, so it never pairs with an imported row.
function toCandidate(
  transaction: OtherAccountTransaction,
  transferCategoryIds: ReadonlySet<string>,
  fallbackTransferCategoryId: string | null,
): TransferCandidate | null {
  const transferCategoryId =
    transaction.categoryId === null
      ? fallbackTransferCategoryId
      : transferCategoryIds.has(transaction.categoryId)
        ? transaction.categoryId
        : null;
  if (transferCategoryId === null) {
    return null;
  }
  return {
    amountOre: toOre(transaction.amountNok),
    bookingTime: transaction.bookingDate.getTime(),
    transferCategoryId,
  };
}

export function suggestTransferCategories(
  rows: TransferLookupRow[],
  otherAccountTransactions: OtherAccountTransaction[],
  transferCategoryIds: string[],
): TransferSuggestion[] {
  const transferCategoryIdSet = new Set(transferCategoryIds);
  const fallbackTransferCategoryId =
    transferCategoryIdSet.size === 1 ? transferCategoryIds[0] : null;
  const candidates = otherAccountTransactions.flatMap((transaction) => {
    const candidate = toCandidate(
      transaction,
      transferCategoryIdSet,
      fallbackTransferCategoryId,
    );
    return candidate === null ? [] : [candidate];
  });
  const used = new Set<TransferCandidate>();

  const suggestions: TransferSuggestion[] = [];
  for (const row of [...rows].sort((a, b) => a.rowNumber - b.rowNumber)) {
    const rowOre = toOre(row.amountNok);
    if (rowOre === 0) {
      continue;
    }

    const rowTime = row.bookingDate.getTime();
    let best: TransferCandidate | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      if (used.has(candidate) || candidate.amountOre !== -rowOre) {
        continue;
      }
      const distance = Math.abs(candidate.bookingTime - rowTime);
      if (distance > MAX_DISTANCE_MS) {
        continue;
      }
      if (
        best === null ||
        distance < bestDistance ||
        (distance === bestDistance && candidate.bookingTime < best.bookingTime)
      ) {
        best = candidate;
        bestDistance = distance;
      }
    }

    if (best !== null) {
      used.add(best);
      suggestions.push({
        rowNumber: row.rowNumber,
        categoryId: best.transferCategoryId,
        confidence: TRANSFER_MATCH_CONFIDENCE,
      });
    }
  }
  return suggestions;
}

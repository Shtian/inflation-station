import type { ParsedCsvRow } from "./csv-parser";

export type TransactionFingerprintParts = {
  accountId: string;
  bookingDate: string;
  amountNok: number;
  normalizedMerchant: string;
  paymentType: string;
};

export type DedupePreparedRow = {
  row: ParsedCsvRow;
  normalizedMerchant: string;
  fingerprint: string;
};

export type DedupeResult = {
  uniqueRows: DedupePreparedRow[];
  duplicateCount: number;
};

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function normalizeBookingDate(value: string): string {
  const trimmed = value.trim();
  const norwegianDate = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);

  if (norwegianDate) {
    const [, day, month, year] = norwegianDate;
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

function normalizeAmount(amountNok: number): string {
  return amountNok.toFixed(2);
}

function resolveNormalizedMerchant(row: ParsedCsvRow): string {
  return normalizeToken(
    [row.recipient, row.sender, row.name, row.title].join(" "),
  );
}

export function buildTransactionFingerprint(
  parts: TransactionFingerprintParts,
): string {
  return [
    normalizeToken(parts.accountId),
    normalizeBookingDate(parts.bookingDate),
    normalizeAmount(parts.amountNok),
    normalizeToken(parts.normalizedMerchant),
    normalizeToken(parts.paymentType),
  ].join("|");
}

export function dedupeParsedTransactions(
  accountId: string,
  rows: ParsedCsvRow[],
  existingFingerprints: ReadonlySet<string> = new Set<string>(),
): DedupeResult {
  const seenFingerprints = new Set(existingFingerprints);
  const uniqueRows: DedupePreparedRow[] = [];
  let duplicateCount = 0;

  for (const row of rows) {
    const normalizedMerchant = resolveNormalizedMerchant(row);
    const fingerprint = buildTransactionFingerprint({
      accountId,
      bookingDate: row.bookingDate,
      amountNok: row.amountNok,
      normalizedMerchant,
      paymentType: row.paymentType,
    });

    if (seenFingerprints.has(fingerprint)) {
      duplicateCount += 1;
      continue;
    }

    seenFingerprints.add(fingerprint);
    uniqueRows.push({
      row,
      normalizedMerchant,
      fingerprint,
    });
  }

  return {
    uniqueRows,
    duplicateCount,
  };
}

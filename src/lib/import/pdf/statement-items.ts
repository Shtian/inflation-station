import type { CsvParserResult, ParsedCsvRow } from "../csv-parser";

export type StatementItem = {
  page: number;
  x: number;
  y: number;
  text: string;
};

export type StatementLine = {
  page: number;
  y: number;
  items: StatementItem[];
};

export type StatementRow = {
  bookingDate: string;
  title: string;
  amountNok: number;
};

export type StatementReconciliation = {
  openingNok: number;
  closingNok: number;
  movementNok: number;
};

export type PdfStatementExtraction = {
  parsed: CsvParserResult;
  reconciliation: StatementReconciliation | null;
};

export const STATEMENT_DATE_PATTERN = /^\d{2}\.\d{2}\.\d{2}$/;
export const STATEMENT_AMOUNT_PATTERN = /^-?\d{1,3}(\.\d{3})*,\d{2}$/;
export const STATEMENT_CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function roundNok(value: number): number {
  // Float error lands a balanced statement on -0, which reads as a signed
  // drift downstream; adding zero collapses it and changes nothing else.
  return Math.round(value * 100) / 100 + 0;
}

export function groupStatementLines(items: StatementItem[]): StatementLine[] {
  const byKey = new Map<string, StatementLine>();

  for (const item of items) {
    const key = `${item.page}:${item.y}`;
    const line = byKey.get(key);
    if (line) {
      line.items.push(item);
      continue;
    }
    byKey.set(key, { page: item.page, y: item.y, items: [item] });
  }

  const lines = [...byKey.values()].sort(
    (a, b) => a.page - b.page || b.y - a.y,
  );
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
  }
  return lines;
}

export function parseNorwegianAmount(text: string): number {
  return Number(text.replaceAll(".", "").replace(",", "."));
}

// One statement straddles the new year (both .25 and .26 appear in it), so an
// invoice-date context would date half the rows wrong. The century is fixed.
export function toBookingDate(shortDate: string): string {
  const [day, month, year] = shortDate.split(".");
  return `${day}.${month}.20${year}`;
}

export function labelledAmount(
  lines: StatementLine[],
  label: string,
): number | null {
  for (const line of lines) {
    const cell = line.items.find((item) => item.text === label);
    if (!cell) continue;

    const amount = line.items.findLast(
      (item) => item.x > cell.x && STATEMENT_AMOUNT_PATTERN.test(item.text),
    );
    if (amount) return parseNorwegianAmount(amount.text);
  }

  return null;
}

export function statementDriftNok(
  reconciliation: StatementReconciliation,
): number {
  return roundNok(
    reconciliation.openingNok +
      reconciliation.movementNok -
      reconciliation.closingNok,
  );
}

export function buildStatementCsvResult(rows: StatementRow[]): CsvParserResult {
  const parsedRows: ParsedCsvRow[] = rows.map((row) => ({
    bookingDate: row.bookingDate,
    amountNok: row.amountNok,
    currency: "NOK",
    sender: "",
    recipient: "",
    // The review table renders `row.title ?? row.name` and `??` does not fall
    // back over "", so the merchant has to be in `title`; normalizeImportMerchant
    // joins name and title, so filling both would double the merchant key.
    name: "",
    title: row.title,
    paymentType: "Kort",
  }));

  return {
    rows: parsedRows,
    errors: [],
    summary: {
      imported: parsedRows.length,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    },
  };
}

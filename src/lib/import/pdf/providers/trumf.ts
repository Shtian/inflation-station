import type { PdfStatementExtractor } from "../registry";
import {
  buildStatementCsvResult,
  groupStatementLines,
  labelledAmount,
  type PdfStatementExtraction,
  parseNorwegianAmount,
  roundNok,
  STATEMENT_AMOUNT_PATTERN,
  STATEMENT_CURRENCY_PATTERN,
  STATEMENT_DATE_PATTERN,
  type StatementItem,
  type StatementLine,
  type StatementRow,
  toBookingDate,
} from "../statement-items";

const PROVIDER_MARKER = "NorgesGruppen Finans AS";
const DATE_COLUMN_X = 48;
const DATE_COLUMN_TOLERANCE = 2;
const TITLE_COLUMN_X = 160;
const WRAP_GAP = 20;

const OPENING_LABEL = "Totalt skyldig beløp forrige periode";
const CLOSING_LABEL = "Nytt skyldig beløp";

function toTransaction(line: StatementLine): StatementRow | null {
  const first = line.items[0];
  if (!first || Math.abs(first.x - DATE_COLUMN_X) > DATE_COLUMN_TOLERANCE) {
    return null;
  }
  if (!STATEMENT_DATE_PATTERN.test(first.text)) return null;

  const amounts = line.items.filter((item) =>
    STATEMENT_AMOUNT_PATTERN.test(item.text),
  );
  // Trumf prints both "Beløp" and "Beløp i NOK"; the rightmost is the NOK one.
  const amount = amounts.at(-1);
  if (!amount) return null;

  const title = line.items
    .filter(
      (item) =>
        !STATEMENT_DATE_PATTERN.test(item.text) &&
        !STATEMENT_AMOUNT_PATTERN.test(item.text) &&
        !STATEMENT_CURRENCY_PATTERN.test(item.text),
    )
    .map((item) => item.text)
    .join(" ");

  return {
    bookingDate: toBookingDate(first.text),
    title,
    // Trumf prints a charge negative, which already matches how the app stores
    // money out, so the printed amount passes through unnegated.
    amountNok: parseNorwegianAmount(amount.text),
  };
}

function isWrappedTitle(
  line: StatementLine,
  previousLine: StatementLine | null,
): boolean {
  if (!previousLine || line.page !== previousLine.page) return false;
  if (previousLine.y - line.y > WRAP_GAP) return false;

  const [only, ...rest] = line.items;
  return (
    rest.length === 0 &&
    only.x >= TITLE_COLUMN_X &&
    !STATEMENT_AMOUNT_PATTERN.test(only.text)
  );
}

function extractRows(lines: StatementLine[]): StatementRow[] {
  const rows: StatementRow[] = [];
  let previousLine: StatementLine | null = null;

  // No table-end detection: "Nytt skyldig beløp" repeats as a page footer
  // (trumf-2026-09 p2 y50 and p3 y630), so stopping there drops a whole page.
  for (const line of lines) {
    const transaction = toTransaction(line);
    if (transaction) {
      rows.push(transaction);
      previousLine = line;
      continue;
    }

    if (rows.length > 0 && isWrappedTitle(line, previousLine)) {
      rows[rows.length - 1].title += ` ${line.items[0].text}`;
      previousLine = line;
    }
  }

  return rows;
}

function extract(items: StatementItem[]): PdfStatementExtraction {
  const lines = groupStatementLines(items);
  const rows = extractRows(lines);

  const openingNok = labelledAmount(lines, OPENING_LABEL);
  const closingNok = labelledAmount(lines, CLOSING_LABEL);

  return {
    parsed: buildStatementCsvResult(rows),
    reconciliation:
      openingNok === null || closingNok === null
        ? null
        : {
            openingNok,
            closingNok,
            movementNok: roundNok(
              rows.reduce((total, row) => total + row.amountNok, 0),
            ),
          },
  };
}

export const trumfPdfStatementExtractor = {
  providerId: "trumf",
  providerName: "Trumf Kredittkort",
  detect(items: StatementItem[]): boolean {
    return items
      .map((item) => item.text)
      .join(" ")
      .includes(PROVIDER_MARKER);
  },
  extract,
} satisfies PdfStatementExtractor;

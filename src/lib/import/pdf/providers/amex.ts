import type { PdfStatementExtractor } from "../registry";
import {
  buildStatementCsvResult,
  groupStatementLines,
  labelledAmount,
  type PdfStatementExtraction,
  parseNorwegianAmount,
  roundNok,
  STATEMENT_AMOUNT_PATTERN,
  STATEMENT_DATE_PATTERN,
  type StatementItem,
  type StatementLine,
  type StatementRow,
  toBookingDate,
} from "../statement-items";

const PROVIDER_MARKER = "SAS Amex Premium";
const END_OF_TABLE = /^(Sum|Totalt)\b/;
const COLUMN_TOLERANCE = 4;
const DETAIL_TOLERANCE = 2;

const OPENING_LABEL = "Saldo forrige periode";
const CLOSING_LABEL = "Ny saldo";

type AmexTableHeader = {
  page: number;
  y: number;
  dateX: number;
  detailX: number;
};

// The two-column page layout makes per-line shape classification ambiguous, so
// the repeated three-cell table header is the anchor that makes it tractable.
function findTableHeaders(lines: StatementLine[]): AmexTableHeader[] {
  const headers: AmexTableHeader[] = [];

  for (const line of lines) {
    const dato = line.items.find((item) => item.text === "-dato");
    if (!dato) continue;

    const detail = line.items.find(
      (item) => item.x > dato.x && item.text === "Detaljer denne periode",
    );
    const amount = line.items.find(
      (item) => item.x > dato.x && item.text === "Beløp NOK",
    );
    if (detail && amount) {
      headers.push({
        page: line.page,
        y: line.y,
        dateX: dato.x,
        detailX: detail.x,
      });
    }
  }

  return headers;
}

function columnEndFor(
  headers: AmexTableHeader[],
  header: AmexTableHeader,
): number {
  // The distinct date-column positions on a page are the column boundaries.
  const starts = [
    ...new Set(
      headers
        .filter((other) => other.page === header.page)
        .map((other) => other.dateX),
    ),
  ].sort((a, b) => a - b);

  return (
    starts.find((start) => start > header.dateX) ?? Number.POSITIVE_INFINITY
  );
}

function extractTable(
  lines: StatementLine[],
  header: AmexTableHeader,
  columnEnd: number,
): StatementRow[] {
  const isInBand = (item: StatementItem) =>
    item.x >= header.dateX - COLUMN_TOLERANCE &&
    item.x < columnEnd - COLUMN_TOLERANCE;
  const rows: StatementRow[] = [];

  for (const line of lines) {
    if (line.page !== header.page || line.y >= header.y) continue;

    const cells = line.items.filter(isInBand);
    if (cells.length === 0) continue;

    const first = cells[0];
    const isAtDateColumn = Math.abs(first.x - header.dateX) <= COLUMN_TOLERANCE;

    if (isAtDateColumn && END_OF_TABLE.test(first.text)) break;

    if (isAtDateColumn && STATEMENT_DATE_PATTERN.test(first.text)) {
      const amount = cells.findLast((cell) =>
        STATEMENT_AMOUNT_PATTERN.test(cell.text),
      );
      if (!amount) continue;

      rows.push({
        bookingDate: toBookingDate(first.text),
        title: cells
          .filter((cell) => cell !== first && cell !== amount)
          .map((cell) => cell.text)
          .join(" "),
        // Amex prints a charge positive; the app stores money out as negative.
        amountNok: -parseNorwegianAmount(amount.text),
      });
      continue;
    }

    // An indented line belongs to the transaction above and is dropped, not
    // appended; a line further left than the detail column is a new section.
    if (first.x >= header.detailX - DETAIL_TOLERANCE) continue;
    break;
  }

  return rows;
}

function extract(items: StatementItem[]): PdfStatementExtraction {
  const lines = groupStatementLines(items);
  const headers = findTableHeaders(lines);
  const rows = headers.flatMap((header) =>
    extractTable(lines, header, columnEndFor(headers, header)),
  );

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
            // The balance walk uses the printed sign, the negation of the stored one.
            movementNok: roundNok(
              -rows.reduce((total, row) => total + row.amountNok, 0),
            ),
          },
  };
}

export const amexPdfStatementExtractor = {
  providerId: "amex",
  providerName: "SAS Amex Premium",
  detect(items: StatementItem[]): boolean {
    return items
      .map((item) => item.text)
      .join(" ")
      .includes(PROVIDER_MARKER);
  },
  extract,
} satisfies PdfStatementExtractor;

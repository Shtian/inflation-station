import type {
  CsvParserResult,
  CsvValidationError,
  ParsedCsvRow,
} from "../csv-parser";
import type { ColumnMapping, ColumnRef } from "./column-mapping";
import { createCsvStatement, type TokenizedCsvRow } from "./csv-statement";
import {
  type CsvDecimalSeparator,
  inferDateFormat,
  inferDecimalSeparator,
  parseAmount,
  parseBookingDate,
} from "./values";

export type CsvTable = {
  headers: string[];
  rows: TokenizedCsvRow[];
};

export function readCsvTable(content: string): CsvTable {
  const tokenized = createCsvStatement(content).tokenize();

  return {
    headers: tokenized.headerRow?.cells ?? [],
    rows: tokenized.dataRows,
  };
}

function cellAt(row: TokenizedCsvRow, ref: ColumnRef): string {
  return (row.cells[ref.index] ?? "").trim();
}

function isReservedBookingDate(value: string): boolean {
  return value.toLowerCase() === "reservert";
}

function amountRefs(mapping: ColumnMapping): ColumnRef[] {
  return mapping.amount.kind === "signed"
    ? [mapping.amount.column]
    : [mapping.amount.inflow, mapping.amount.outflow];
}

function nonEmptyCells(rows: TokenizedCsvRow[], refs: ColumnRef[]): string[] {
  return rows
    .flatMap((row) => refs.map((ref) => cellAt(row, ref)))
    .filter((value) => value.length > 0);
}

type AmountResult =
  | { ok: true; amountNok: number }
  | { ok: false; raw: string };

function readAmount(
  row: TokenizedCsvRow,
  mapping: ColumnMapping,
  decimalSeparator: CsvDecimalSeparator,
): AmountResult {
  if (mapping.amount.kind === "signed") {
    const raw = cellAt(row, mapping.amount.column);
    const amountNok = parseAmount(raw, decimalSeparator);
    return amountNok === null ? { ok: false, raw } : { ok: true, amountNok };
  }

  const inflowRaw = cellAt(row, mapping.amount.inflow);
  const outflowRaw = cellAt(row, mapping.amount.outflow);
  const raw = [inflowRaw, outflowRaw].filter(Boolean).join(" / ");

  if (!inflowRaw && !outflowRaw) {
    return { ok: false, raw };
  }

  const inflow = inflowRaw ? parseAmount(inflowRaw, decimalSeparator) : 0;
  const outflow = outflowRaw ? parseAmount(outflowRaw, decimalSeparator) : 0;

  if (inflow === null || outflow === null) {
    return { ok: false, raw };
  }

  // Banks disagree on whether the outflow column carries a minus sign, so the
  // direction comes from the column alone.
  const amountNok =
    Math.round((Math.abs(inflow) - Math.abs(outflow)) * 100) / 100;
  return { ok: true, amountNok };
}

export function parseMappedCsv(
  table: CsvTable,
  mapping: ColumnMapping,
): CsvParserResult {
  const dateFormat = inferDateFormat(
    nonEmptyCells(table.rows, [mapping.date]).filter(
      (value) => !isReservedBookingDate(value),
    ),
  );
  const decimalSeparator = inferDecimalSeparator(
    nonEmptyCells(table.rows, amountRefs(mapping)),
  );

  const rows: ParsedCsvRow[] = [];
  const errors: CsvValidationError[] = [];
  let ignoredReserved = 0;

  for (const row of table.rows) {
    const rowNumber = row.sourceRowNumber;
    const bookingDateRaw = cellAt(row, mapping.date);

    if (isReservedBookingDate(bookingDateRaw)) {
      ignoredReserved += 1;
      continue;
    }

    const bookingDate = dateFormat
      ? parseBookingDate(bookingDateRaw, dateFormat)
      : null;
    if (bookingDate === null) {
      errors.push({
        rowNumber,
        code: "INVALID_BOOKING_DATE",
        message: dateFormat
          ? `Row ${rowNumber} has booking date "${bookingDateRaw}" that does not match the format ${dateFormat}.`
          : `Row ${rowNumber} has booking date "${bookingDateRaw}", which is not a recognized date.`,
      });
      continue;
    }

    const amount = readAmount(row, mapping, decimalSeparator);
    if (!amount.ok) {
      errors.push({
        rowNumber,
        code: "INVALID_AMOUNT",
        message: `Row ${rowNumber} has invalid amount "${amount.raw}". Expected a number using "${decimalSeparator}" as the decimal separator.`,
      });
      continue;
    }

    rows.push({
      bookingDate,
      amountNok: amount.amountNok,
      currency: "NOK",
      sender: "",
      recipient: "",
      name: "",
      title: mapping.description
        .map((ref) => cellAt(row, ref))
        .filter((value) => value.length > 0)
        .join(" "),
      paymentType: mapping.paymentType ? cellAt(row, mapping.paymentType) : "",
    });
  }

  return {
    rows,
    errors,
    summary: {
      imported: rows.length,
      duplicates: 0,
      ignoredReserved,
      invalid: errors.length,
    },
  };
}

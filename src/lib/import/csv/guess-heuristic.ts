import type { ColumnMappingDraft, ColumnRef } from "./column-mapping";
import { normalizeCsvHeader } from "./csv-statement";
import {
  inferDateFormat,
  inferDecimalSeparator,
  parseAmount,
  parseBookingDate,
} from "./values";

function normalizedAliases(aliases: string[]): string[] {
  return aliases.map((alias) => normalizeCsvHeader(alias));
}

// Ordered by preference: the first alias present in the file wins.
const DATE_ALIASES = normalizedAliases([
  "Bokføringsdato",
  "BookingDate",
  "Dato",
  "Date",
]);
const SIGNED_AMOUNT_ALIASES = normalizedAliases(["Beløp", "Amount"]);
const INFLOW_ALIASES = normalizedAliases(["Inn på konto", "Inn"]);
const OUTFLOW_ALIASES = normalizedAliases(["Ut fra konto", "Ut"]);
const PAYMENT_TYPE_ALIASES = normalizedAliases([
  "Betalingstype",
  "PaymentType",
]);
// Every matching column is used, in file order, so Nordea's Navn + Tittel
// produce the same merchant text the old name/title split did.
const DESCRIPTION_ALIASES = normalizedAliases([
  "Navn",
  "Name",
  "Tittel",
  "Title",
  "Beskrivelse",
  "Description",
  "Forklaring",
  "Tekst",
  "Text",
]);

type Column = {
  ref: ColumnRef;
  normalizedHeader: string;
  samples: string[];
};

function toColumns(
  headers: readonly string[],
  sampleRows: readonly (readonly string[])[],
): Column[] {
  return headers.map((header, index) => ({
    ref: { index, header },
    normalizedHeader: normalizeCsvHeader(header),
    samples: sampleRows
      .map((cells) => (cells[index] ?? "").trim())
      .filter((value) => value.length > 0),
  }));
}

function findByAliases(
  columns: Column[],
  aliases: string[],
  used: Set<number>,
): Column | null {
  for (const alias of aliases) {
    const column = columns.find(
      (candidate) =>
        candidate.normalizedHeader === alias && !used.has(candidate.ref.index),
    );
    if (column) {
      return column;
    }
  }

  return null;
}

function isDateColumn(column: Column): boolean {
  const values = column.samples.filter(
    (value) => value.toLowerCase() !== "reservert",
  );
  const format = inferDateFormat(values);

  return (
    format !== null &&
    values.every((value) => parseBookingDate(value, format) !== null)
  );
}

function isAmountColumn(column: Column): boolean {
  if (column.samples.length === 0) {
    return false;
  }

  const separator = inferDecimalSeparator(column.samples);
  return column.samples.every(
    (value) => parseAmount(value, separator) !== null,
  );
}

// An ID or reference column is numeric too; money carries a sign or decimals.
function looksMonetary(column: Column): boolean {
  return column.samples.some((value) => /^[-+−]|[.,]\d{1,2}$/.test(value));
}

function averageLength(column: Column): number {
  const total = column.samples.reduce((sum, value) => sum + value.length, 0);
  return column.samples.length === 0 ? 0 : total / column.samples.length;
}

/**
 * Deterministic first guess: known Norwegian and English header names, then
 * the shape of the sample values for whatever the headers did not settle.
 */
export function guessColumnMappingHeuristically(
  headers: readonly string[],
  sampleRows: readonly (readonly string[])[],
): ColumnMappingDraft {
  const columns = toColumns(headers, sampleRows);
  const used = new Set<number>();
  const claim = (column: Column | null | undefined): ColumnRef | null => {
    if (!column) {
      return null;
    }
    used.add(column.ref.index);
    return column.ref;
  };

  let date = claim(findByAliases(columns, DATE_ALIASES, used));

  let amount: ColumnMappingDraft["amount"] = null;
  const signed = claim(findByAliases(columns, SIGNED_AMOUNT_ALIASES, used));
  if (signed) {
    amount = { kind: "signed", column: signed };
  } else {
    const inflow = findByAliases(columns, INFLOW_ALIASES, used);
    const outflow = findByAliases(columns, OUTFLOW_ALIASES, used);
    if (inflow && outflow) {
      amount = {
        kind: "split",
        inflow: claim(inflow) as ColumnRef,
        outflow: claim(outflow) as ColumnRef,
      };
    }
  }

  let description = columns
    .filter(
      (column) =>
        DESCRIPTION_ALIASES.includes(column.normalizedHeader) &&
        !used.has(column.ref.index),
    )
    .map((column) => claim(column) as ColumnRef);

  const paymentType = claim(findByAliases(columns, PAYMENT_TYPE_ALIASES, used));

  const unused = () => columns.filter((column) => !used.has(column.ref.index));

  if (!date) {
    date = claim(unused().find(isDateColumn));
  }

  if (!amount) {
    const numeric = unused().filter(
      (candidate) => !isDateColumn(candidate) && isAmountColumn(candidate),
    );
    const column = claim(numeric.find(looksMonetary) ?? numeric[0]);
    amount = column ? { kind: "signed", column } : null;
  }

  if (description.length === 0) {
    const freeText = unused()
      .filter(
        (column) =>
          column.samples.length > 0 &&
          !isDateColumn(column) &&
          !isAmountColumn(column),
      )
      .sort((a, b) => averageLength(b) - averageLength(a))[0];
    const column = claim(freeText);
    description = column ? [column] : [];
  }

  return { date, amount, description, paymentType };
}

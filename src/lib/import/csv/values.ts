export const CSV_DATE_FORMATS = [
  "DD.MM.YYYY",
  "DD.MM.YY",
  "YYYY-MM-DD",
  "YYYY/MM/DD",
] as const;

export type CsvDateFormat = (typeof CSV_DATE_FORMATS)[number];

export type CsvDecimalSeparator = "," | ".";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NORWEGIAN_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const NORWEGIAN_SHORT_YEAR_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{2})$/;
const SLASH_DATE_PATTERN = /^(\d{4})\/(\d{2})\/(\d{2})$/;

function buildUtcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function toIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function assertNeverDateFormat(format: never): never {
  throw new Error(`Unsupported CSV date format: ${JSON.stringify(format)}`);
}

/**
 * Parses `value` against the declared date format only. A value that
 * matches a different (but otherwise valid) format, or that is a calendar-invalid
 * date, returns null rather than guessing — day/month must never be silently
 * reinterpreted.
 */
export function parseBookingDate(
  value: string,
  format: CsvDateFormat,
): string | null {
  const trimmed = value.trim();

  let match: RegExpExecArray | null;
  let year: string;
  let month: string;
  let day: string;

  switch (format) {
    case "YYYY-MM-DD": {
      match = ISO_DATE_PATTERN.exec(trimmed);
      if (!match) {
        return null;
      }
      [, year, month, day] = match;
      break;
    }
    case "YYYY/MM/DD": {
      match = SLASH_DATE_PATTERN.exec(trimmed);
      if (!match) {
        return null;
      }
      [, year, month, day] = match;
      break;
    }
    case "DD.MM.YYYY": {
      match = NORWEGIAN_DATE_PATTERN.exec(trimmed);
      if (!match) {
        return null;
      }
      [, day, month, year] = match;
      break;
    }
    case "DD.MM.YY": {
      match = NORWEGIAN_SHORT_YEAR_DATE_PATTERN.exec(trimmed);
      if (!match) {
        return null;
      }
      [, day, month] = match;
      year = String(2000 + Number(match[3]));
      break;
    }
    default:
      return assertNeverDateFormat(format);
  }

  const date = buildUtcDate(Number(year), Number(month), Number(day));
  return date ? toIsoDateString(date) : null;
}

type SignExtraction = {
  negative: boolean;
  body: string;
};

function extractAmountSign(value: string): SignExtraction | null {
  let body = value;
  let leadingSign = false;
  let leadingNegative = false;

  if (body.startsWith("-")) {
    leadingSign = true;
    leadingNegative = true;
    body = body.slice(1);
  } else if (body.startsWith("+")) {
    leadingSign = true;
    body = body.slice(1);
  }

  let trailingNegative = false;
  if (body.endsWith("-")) {
    trailingNegative = true;
    body = body.slice(0, -1);
  }

  // A value cannot declare its sign both before and after the digits.
  if (leadingSign && trailingNegative) {
    return null;
  }

  return { negative: leadingNegative || trailingNegative, body };
}

/**
 * Splits `integerPart` on the thousands separator(s) and returns the plain
 * digit string, or null when the grouping is not a valid 3-digit grouping.
 * A part with no separator at all is accepted at any length (matches values
 * with no thousands formatting).
 */
function parseGroupedIntegerDigits(
  integerPart: string,
  thousandsPattern: RegExp,
): string | null {
  if (integerPart.length === 0) {
    return null;
  }

  const groups = integerPart.split(thousandsPattern);
  if (groups.some((group) => group.length === 0)) {
    return null;
  }

  if (groups.length === 1) {
    return /^\d+$/.test(groups[0]) ? groups[0] : null;
  }

  const [firstGroup, ...restGroups] = groups;
  if (!/^\d{1,3}$/.test(firstGroup)) {
    return null;
  }
  if (!restGroups.every((group) => /^\d{3}$/.test(group))) {
    return null;
  }

  return groups.join("");
}

/**
 * Parses `value` against the declared decimal separator. Thousands
 * handling is deterministic: with decimal separator "," the thousands
 * separators are "." and any whitespace (including NBSP and thin space); with
 * "." they are "," and whitespace. Grouped digits must form valid 3-digit
 * groups. A value with an ambiguous or malformed separator pattern (wrong
 * grouping, multiple decimal separators, non-digit fraction, sign declared
 * twice) returns null rather than guessing.
 */
export function parseAmount(
  value: string,
  decimalSeparator: CsvDecimalSeparator,
): number | null {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  const signed = extractAmountSign(trimmedValue);
  if (!signed) {
    return null;
  }

  const body = signed.body.trim();
  if (body.length === 0) {
    return null;
  }

  const decimalParts = body.split(decimalSeparator);
  if (decimalParts.length > 2) {
    return null;
  }

  const [integerPart, fractionPart = null] = decimalParts;
  if (fractionPart !== null && !/^\d+$/.test(fractionPart)) {
    return null;
  }

  const thousandsChar = decimalSeparator === "," ? "." : ",";
  const thousandsPattern = new RegExp(`[${thousandsChar}\\s]+`);
  const integerDigits = parseGroupedIntegerDigits(
    integerPart,
    thousandsPattern,
  );
  if (integerDigits === null) {
    return null;
  }

  const numericString =
    fractionPart === null ? integerDigits : `${integerDigits}.${fractionPart}`;
  const magnitude = Number.parseFloat(numericString);
  if (!Number.isFinite(magnitude)) {
    return null;
  }

  return signed.negative ? -magnitude : magnitude;
}

function countMatches<T>(
  values: readonly string[],
  candidates: readonly T[],
  parse: (value: string, candidate: T) => unknown,
): T | null {
  let best: T | null = null;
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = values.filter(
      (value) => parse(value, candidate) !== null,
    ).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

/** The format that parses the most of `values`, or null when none parses any. */
export function inferDateFormat(
  values: readonly string[],
): CsvDateFormat | null {
  return countMatches(values, CSV_DATE_FORMATS, parseBookingDate);
}

/**
 * The separator that parses the most of `values`. A tie, such as a column of
 * whole numbers, resolves to "," because the statements this app imports are
 * Norwegian.
 */
export function inferDecimalSeparator(
  values: readonly string[],
): CsvDecimalSeparator {
  return countMatches(values, [",", "."] as const, parseAmount) === "."
    ? "."
    : ",";
}

import type {
  ProviderDateFormat,
  ProviderDecimalSeparator,
  ProviderFieldTransform,
} from "./mapping-definition";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NORWEGIAN_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;

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

/**
 * Parses `value` against the adapter's declared date format only. A value that
 * matches a different (but otherwise valid) format, or that is a calendar-invalid
 * date, returns null rather than guessing — day/month must never be silently
 * reinterpreted.
 */
export function parseProviderBookingDate(
  value: string,
  format: ProviderDateFormat,
): string | null {
  const trimmed = value.trim();

  if (format === "YYYY-MM-DD") {
    const match = ISO_DATE_PATTERN.exec(trimmed);
    if (!match) {
      return null;
    }
    const [, year, month, day] = match;
    const date = buildUtcDate(Number(year), Number(month), Number(day));
    return date ? toIsoDateString(date) : null;
  }

  const match = NORWEGIAN_DATE_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
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
 * Parses `value` against the adapter's declared decimal separator. Thousands
 * handling is deterministic: with decimal separator "," the thousands
 * separators are "." and any whitespace (including NBSP and thin space); with
 * "." they are "," and whitespace. Grouped digits must form valid 3-digit
 * groups. A value with an ambiguous or malformed separator pattern (wrong
 * grouping, multiple decimal separators, non-digit fraction, sign declared
 * twice) returns null rather than guessing.
 */
export function parseProviderAmount(
  value: string,
  decimalSeparator: ProviderDecimalSeparator,
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

function foldMapValuesKey(value: string): string {
  return value.trim().toLowerCase();
}

function applyMapValuesTransform(
  value: string,
  transform: Extract<ProviderFieldTransform, { type: "mapValues" }>,
): string {
  const targetKey = foldMapValuesKey(value);

  for (const [candidateKey, mappedValue] of Object.entries(transform.values)) {
    if (foldMapValuesKey(candidateKey) === targetKey) {
      return mappedValue;
    }
  }

  return transform.fallback ?? value;
}

/**
 * Forces a sign convention onto `value`'s leading/trailing "+"/"-" characters.
 * This is a plain string operation with no awareness of which canonical field
 * it runs against: it is meaningful for the "amount" field (where it forces
 * the parsed sign) and is a deliberate, tested no-op-like pass-through for
 * any other field that happens to carry a leading/trailing sign character —
 * it does not otherwise rewrite the value.
 */
function applySignTransform(
  value: string,
  sign: "negative" | "positive",
): string {
  let body = value;

  if (body.startsWith("+") || body.startsWith("-")) {
    body = body.slice(1);
  }
  if (body.endsWith("-")) {
    body = body.slice(0, -1);
  }

  return sign === "negative" ? `-${body}` : body;
}

function assertNeverTransform(transform: never): never {
  throw new Error(
    `Unsupported provider field transform: ${JSON.stringify(transform)}`,
  );
}

/**
 * Executes `transforms` against `value` in stored order. Runs after cell
 * extraction and before canonical field validation (date/amount parsing,
 * currency checks).
 */
export function applyProviderTransforms(
  value: string,
  transforms: ReadonlyArray<ProviderFieldTransform>,
): string {
  return transforms.reduce((current, transform) => {
    switch (transform.type) {
      case "trim":
        return current.trim();
      case "uppercase":
        return current.toUpperCase();
      case "lowercase":
        return current.toLowerCase();
      case "mapValues":
        return applyMapValuesTransform(current, transform);
      case "applySign":
        return applySignTransform(current, transform.sign);
      default:
        return assertNeverTransform(transform);
    }
  }, value);
}

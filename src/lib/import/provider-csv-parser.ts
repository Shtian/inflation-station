import type {
  CsvParserResult,
  CsvValidationError,
  ParsedCsvRow,
} from "./csv-parser";
import {
  MERCHANT_SIGNAL_CANONICAL_FIELDS,
  PROVIDER_CANONICAL_FIELDS,
  REQUIRED_PROVIDER_CANONICAL_FIELDS,
} from "./provider-mapping-contract";

export type ProviderFieldMapping = {
  sourceField: string;
  canonicalField: string;
  transformRules: unknown;
};

export type ProviderCsvMapping = {
  id: string;
  providerName: string;
  fieldMappings: ReadonlyArray<ProviderFieldMapping>;
  normalizationRules: unknown;
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("ø", "o")
    .replaceAll("æ", "ae")
    .replaceAll("å", "a")
    .replaceAll(/[^a-z0-9]/g, "");
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  cells.push(value.trim());
  return cells;
}

function resolveDelimiter(headerLine: string): ";" | "," {
  const semicolonCells = parseDelimitedLine(headerLine, ";");
  const commaCells = parseDelimitedLine(headerLine, ",");

  if (semicolonCells.length >= commaCells.length) {
    return ";";
  }

  return ",";
}

function parseNokAmount(value: string): number | null {
  const normalized = value
    .replaceAll(/\s/g, "")
    .replaceAll(".", "")
    .replace(",", ".");
  const numeric = Number.parseFloat(normalized);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

function isReservedBookingDate(value: string): boolean {
  return value.trim().toLowerCase() === "reservert";
}

type CanonicalField = (typeof PROVIDER_CANONICAL_FIELDS)[number];
type HeaderMap = Partial<Record<CanonicalField, number>>;

function buildFieldMap(
  mapping: ProviderCsvMapping,
): Map<CanonicalField, string> {
  const mappedFields = new Map<CanonicalField, string>();

  for (const fieldMapping of mapping.fieldMappings) {
    const canonicalField = fieldMapping.canonicalField as CanonicalField;
    if (!PROVIDER_CANONICAL_FIELDS.includes(canonicalField)) {
      continue;
    }

    if (!fieldMapping.sourceField.trim()) {
      continue;
    }

    mappedFields.set(canonicalField, fieldMapping.sourceField);
  }

  return mappedFields;
}

function buildHeaderMap(
  headerLine: string,
  mapping: ProviderCsvMapping,
): HeaderMap | null {
  const delimiter = resolveDelimiter(headerLine);
  const headerCells = parseDelimitedLine(headerLine, delimiter);
  const normalizedHeaders = headerCells.map((header) =>
    normalizeHeader(header),
  );
  const fieldMap = buildFieldMap(mapping);
  const resolved = {} as HeaderMap;

  for (const canonicalField of REQUIRED_PROVIDER_CANONICAL_FIELDS) {
    const mappedSourceField = fieldMap.get(canonicalField);
    if (!mappedSourceField) {
      return null;
    }

    const sourceIndex = normalizedHeaders.indexOf(
      normalizeHeader(mappedSourceField),
    );

    if (sourceIndex === -1) {
      return null;
    }

    resolved[canonicalField] = sourceIndex;
  }

  const merchantSignalIndexes = MERCHANT_SIGNAL_CANONICAL_FIELDS.map(
    (canonicalField) => {
      const mappedSourceField = fieldMap.get(canonicalField);
      if (!mappedSourceField) {
        return null;
      }

      const sourceIndex = normalizedHeaders.indexOf(
        normalizeHeader(mappedSourceField),
      );

      if (sourceIndex === -1) {
        return null;
      }

      resolved[canonicalField] = sourceIndex;
      return sourceIndex;
    },
  ).filter((index): index is number => index !== null);

  if (merchantSignalIndexes.length === 0) {
    return null;
  }

  for (const canonicalField of PROVIDER_CANONICAL_FIELDS) {
    if (canonicalField in resolved) {
      continue;
    }

    const mappedSourceField = fieldMap.get(canonicalField);
    if (!mappedSourceField) {
      continue;
    }

    const sourceIndex = normalizedHeaders.indexOf(
      normalizeHeader(mappedSourceField),
    );
    if (sourceIndex === -1) {
      continue;
    }

    resolved[canonicalField] = sourceIndex;
  }

  return resolved;
}

function missingHeadersResult(
  providerName: string,
  rowNumber = 1,
): CsvParserResult {
  return {
    rows: [],
    errors: [
      {
        rowNumber,
        code: "MISSING_REQUIRED_HEADERS",
        message: `Missing required provider mapping headers for ${providerName}.`,
      },
    ],
    summary: {
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    },
  };
}

export function parseProviderMappedCsv(
  csvContent: string,
  mapping: ProviderCsvMapping,
): CsvParserResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return missingHeadersResult(mapping.providerName);
  }

  const headerLine = lines[0];
  const delimiter = resolveDelimiter(headerLine);
  const headerMap = buildHeaderMap(headerLine, mapping);

  if (!headerMap) {
    return missingHeadersResult(mapping.providerName);
  }

  const rows: ParsedCsvRow[] = [];
  const errors: CsvValidationError[] = [];
  let ignoredReserved = 0;

  for (let index = 1; index < lines.length; index += 1) {
    const rowNumber = index + 1;
    const cells = parseDelimitedLine(lines[index], delimiter);

    const bookingDate = cells[headerMap.bookingDate ?? -1] ?? "";
    if (!bookingDate.trim()) {
      errors.push({
        rowNumber,
        code: "INVALID_COLUMN_COUNT",
        message: `Row ${rowNumber} is missing required value for bookingDate.`,
      });
      continue;
    }

    if (isReservedBookingDate(bookingDate)) {
      ignoredReserved += 1;
      continue;
    }

    const amountValue = cells[headerMap.amount ?? -1] ?? "";
    const amountNok = parseNokAmount(amountValue);
    if (amountNok === null) {
      errors.push({
        rowNumber,
        code: "INVALID_AMOUNT",
        message: `Row ${rowNumber} has invalid amount "${amountValue}". Expected Norwegian decimal format like 123,45.`,
      });
      continue;
    }

    const currencyIndex = headerMap.currency;
    const currencyValue =
      currencyIndex === undefined
        ? "NOK"
        : (cells[currencyIndex] ?? "").toUpperCase();
    if (currencyValue !== "NOK") {
      errors.push({
        rowNumber,
        code: "INVALID_CURRENCY",
        message: `Row ${rowNumber} has unsupported currency "${currencyIndex === undefined ? "" : (cells[currencyIndex] ?? "")}". Only NOK is accepted.`,
      });
      continue;
    }

    const sender =
      headerMap.sender === undefined ? "" : (cells[headerMap.sender] ?? "");
    const recipient =
      headerMap.recipient === undefined
        ? ""
        : (cells[headerMap.recipient] ?? "");
    const name =
      headerMap.name === undefined ? "" : (cells[headerMap.name] ?? "");
    const title =
      headerMap.title === undefined ? "" : (cells[headerMap.title] ?? "");
    const paymentType =
      headerMap.paymentType === undefined
        ? ""
        : (cells[headerMap.paymentType] ?? "");

    rows.push({
      bookingDate,
      amountNok,
      currency: "NOK",
      sender,
      recipient,
      name,
      title,
      paymentType,
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

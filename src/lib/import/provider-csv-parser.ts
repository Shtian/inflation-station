import type {
  CsvParserResult,
  CsvValidationError,
  ParsedCsvRow,
} from "./csv-parser";
import {
  createCsvStatement,
  normalizeCsvHeader,
  type TokenizedCsv,
} from "./provider-adapter/csv-statement";
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
  normalizedHeaders: string[],
  mapping: ProviderCsvMapping,
): HeaderMap | null {
  const fieldMap = buildFieldMap(mapping);
  const resolved = {} as HeaderMap;

  for (const canonicalField of REQUIRED_PROVIDER_CANONICAL_FIELDS) {
    const mappedSourceField = fieldMap.get(canonicalField);
    if (!mappedSourceField) {
      return null;
    }

    const sourceIndex = normalizedHeaders.indexOf(
      normalizeCsvHeader(mappedSourceField),
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
        normalizeCsvHeader(mappedSourceField),
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
      normalizeCsvHeader(mappedSourceField),
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
  if (csvContent.trim().length === 0) {
    return missingHeadersResult(mapping.providerName);
  }

  const statement = createCsvStatement(csvContent);
  const tokenized: TokenizedCsv = statement.tokenize(
    statement.inferredDelimiter,
  );
  const headerMap = tokenized.headerRow
    ? buildHeaderMap(tokenized.normalizedHeaders, mapping)
    : null;

  if (!headerMap) {
    return missingHeadersResult(mapping.providerName);
  }

  const rows: ParsedCsvRow[] = [];
  const errors: CsvValidationError[] = [];
  let ignoredReserved = 0;

  for (let index = 0; index < tokenized.dataRows.length; index += 1) {
    const rowNumber = index + 2;
    const cells = tokenized.dataRows[index].cells;

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

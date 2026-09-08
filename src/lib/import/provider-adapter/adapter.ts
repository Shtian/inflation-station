import type {
  CsvParserResult,
  CsvValidationError,
  ParsedCsvRow,
} from "../csv-parser";
import {
  MERCHANT_SIGNAL_CANONICAL_FIELDS,
  REQUIRED_PROVIDER_CANONICAL_FIELDS,
} from "../provider-mapping-contract";
import type {
  CsvStatement,
  TokenizedCsv,
  TokenizedCsvRow,
} from "./csv-statement";
import { normalizeCsvHeader } from "./csv-statement";
import type {
  ProviderCanonicalField,
  ProviderFieldDefinition,
  ProviderMappingDefinition,
} from "./mapping-definition";
import {
  applyProviderTransforms,
  parseProviderAmount,
  parseProviderBookingDate,
} from "./values";

export type ProviderAdapterDetectionCandidate = {
  providerId: string;
  providerName: string;
  requiredMatches: number;
  requiredTotal: number;
  patternMatches: number;
  score: number;
  matchedHeaders: string[];
};

export type ProviderAdapter = {
  readonly providerId: string;
  readonly providerName: string;
  detect(statement: CsvStatement): ProviderAdapterDetectionCandidate;
  parse(statement: CsvStatement): CsvParserResult;
};

type HeaderIndexMap = Partial<Record<ProviderCanonicalField, number>>;

function resolveRequiredHeaders(
  definition: ProviderMappingDefinition,
): string[] {
  if (definition.detection.requiredHeaders.length > 0) {
    return definition.detection.requiredHeaders.map((header) =>
      normalizeCsvHeader(header),
    );
  }

  return definition.fields
    .map((field) => field.normalizedSourceHeader)
    .filter((header) => header.length > 0);
}

function extractHeaderLineText(
  statement: CsvStatement,
  headerRow: TokenizedCsvRow,
): string {
  const lines = statement.content.split(/\r\n|\n/);
  return (lines[headerRow.sourceRowNumber - 1] ?? "").trim();
}

function isReservedBookingDate(value: string): boolean {
  return value.trim().toLowerCase() === "reservert";
}

function missingHeadersResult(providerName: string): CsvParserResult {
  return {
    rows: [],
    errors: [
      {
        rowNumber: 1,
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

function buildHeaderIndexMap(
  definition: ProviderMappingDefinition,
  tokenized: TokenizedCsv,
): HeaderIndexMap | null {
  const indexByCanonicalField: HeaderIndexMap = {};

  for (const field of definition.fields) {
    const sourceIndex = tokenized.normalizedHeaders.indexOf(
      field.normalizedSourceHeader,
    );
    if (sourceIndex !== -1) {
      indexByCanonicalField[field.canonicalField] = sourceIndex;
    }
  }

  for (const canonicalField of REQUIRED_PROVIDER_CANONICAL_FIELDS) {
    if (indexByCanonicalField[canonicalField] === undefined) {
      return null;
    }
  }

  const hasMerchantSignal = MERCHANT_SIGNAL_CANONICAL_FIELDS.some(
    (canonicalField) => indexByCanonicalField[canonicalField] !== undefined,
  );
  if (!hasMerchantSignal) {
    return null;
  }

  return indexByCanonicalField;
}

function buildFieldsByCanonical(
  definition: ProviderMappingDefinition,
): Partial<Record<ProviderCanonicalField, ProviderFieldDefinition>> {
  const fieldsByCanonical: Partial<
    Record<ProviderCanonicalField, ProviderFieldDefinition>
  > = {};

  for (const field of definition.fields) {
    fieldsByCanonical[field.canonicalField] = field;
  }

  return fieldsByCanonical;
}

function extractTransformedFieldValues(
  cells: string[],
  headerIndexMap: HeaderIndexMap,
  fieldsByCanonical: Partial<
    Record<ProviderCanonicalField, ProviderFieldDefinition>
  >,
): Partial<Record<ProviderCanonicalField, string>> {
  const fieldValues: Partial<Record<ProviderCanonicalField, string>> = {};

  for (const [canonicalField, sourceIndex] of Object.entries(
    headerIndexMap,
  ) as Array<[ProviderCanonicalField, number]>) {
    const rawValue = cells[sourceIndex] ?? "";
    const transforms = fieldsByCanonical[canonicalField]?.transforms ?? [];
    fieldValues[canonicalField] = applyProviderTransforms(rawValue, transforms);
  }

  return fieldValues;
}

export function createProviderAdapter(
  definition: ProviderMappingDefinition,
): ProviderAdapter {
  const requiredHeaders = resolveRequiredHeaders(definition);
  const anyHeaders = definition.detection.anyHeaders.map((header) =>
    normalizeCsvHeader(header),
  );
  const headerPatterns = definition.detection.headerPatterns;
  const fieldsByCanonical = buildFieldsByCanonical(definition);

  function resolveDelimiter(statement: CsvStatement) {
    return definition.delimiter ?? statement.inferredDelimiter;
  }

  function detect(statement: CsvStatement): ProviderAdapterDetectionCandidate {
    const tokenized = statement.tokenize(resolveDelimiter(statement));
    const normalizedHeaderSet = new Set(tokenized.normalizedHeaders);

    const requiredMatches = requiredHeaders.filter((header) =>
      normalizedHeaderSet.has(header),
    );
    const optionalMatches = anyHeaders.filter((header) =>
      normalizedHeaderSet.has(header),
    );

    const requiredCoverage =
      requiredHeaders.length === 0
        ? 0
        : requiredMatches.length / requiredHeaders.length;
    const optionalCoverage =
      anyHeaders.length === 0 ? 0 : optionalMatches.length / anyHeaders.length;

    const headerLineText = tokenized.headerRow
      ? extractHeaderLineText(statement, tokenized.headerRow)
      : "";
    const patternMatches = headerPatterns.reduce((count, pattern) => {
      const regex = new RegExp(pattern, "i");
      return regex.test(headerLineText) ? count + 1 : count;
    }, 0);

    const score = Number(
      (
        requiredCoverage +
        optionalCoverage * 0.5 +
        patternMatches * 0.25
      ).toFixed(4),
    );

    return {
      providerId: definition.providerId,
      providerName: definition.providerName,
      requiredMatches: requiredMatches.length,
      requiredTotal: requiredHeaders.length,
      patternMatches,
      score,
      matchedHeaders: [...requiredMatches, ...optionalMatches],
    };
  }

  function parse(statement: CsvStatement): CsvParserResult {
    if (statement.content.trim().length === 0) {
      return missingHeadersResult(definition.providerName);
    }

    const tokenized = statement.tokenize(resolveDelimiter(statement));
    const headerIndexMap = tokenized.headerRow
      ? buildHeaderIndexMap(definition, tokenized)
      : null;

    if (!headerIndexMap) {
      return missingHeadersResult(definition.providerName);
    }

    const rows: ParsedCsvRow[] = [];
    const errors: CsvValidationError[] = [];
    let ignoredReserved = 0;

    for (const dataRow of tokenized.dataRows) {
      const rowNumber = dataRow.sourceRowNumber;
      const fieldValues = extractTransformedFieldValues(
        dataRow.cells,
        headerIndexMap,
        fieldsByCanonical,
      );

      const bookingDateRaw = fieldValues.bookingDate ?? "";
      if (!bookingDateRaw.trim()) {
        errors.push({
          rowNumber,
          code: "INVALID_COLUMN_COUNT",
          message: `Row ${rowNumber} is missing required value for bookingDate.`,
        });
        continue;
      }

      if (isReservedBookingDate(bookingDateRaw)) {
        ignoredReserved += 1;
        continue;
      }

      const bookingDate = parseProviderBookingDate(
        bookingDateRaw,
        definition.dateFormat,
      );
      if (bookingDate === null) {
        errors.push({
          rowNumber,
          code: "INVALID_BOOKING_DATE",
          message: `Row ${rowNumber} has booking date "${bookingDateRaw}" that does not match the expected format ${definition.dateFormat}.`,
        });
        continue;
      }

      const amountRaw = fieldValues.amount ?? "";
      const amountNok = parseProviderAmount(
        amountRaw,
        definition.decimalSeparator,
      );
      if (amountNok === null) {
        errors.push({
          rowNumber,
          code: "INVALID_AMOUNT",
          message: `Row ${rowNumber} has invalid amount "${amountRaw}". Expected decimal format using "${definition.decimalSeparator}" as the decimal separator.`,
        });
        continue;
      }

      const currencyRaw = fieldValues.currency;
      const currencyValue =
        currencyRaw === undefined ? "NOK" : currencyRaw.toUpperCase();
      if (currencyValue !== "NOK") {
        errors.push({
          rowNumber,
          code: "INVALID_CURRENCY",
          message: `Row ${rowNumber} has unsupported currency "${currencyRaw ?? ""}". Only NOK is accepted.`,
        });
        continue;
      }

      rows.push({
        bookingDate,
        amountNok,
        currency: "NOK",
        sender: fieldValues.sender ?? "",
        recipient: fieldValues.recipient ?? "",
        name: fieldValues.name ?? "",
        title: fieldValues.title ?? "",
        paymentType: fieldValues.paymentType ?? "",
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

  return {
    providerId: definition.providerId,
    providerName: definition.providerName,
    detect,
    parse,
  };
}

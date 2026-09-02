import type {
  CsvParserResult,
  CsvValidationError,
  ParsedCsvRow,
} from "../csv-parser";
import {
  MERCHANT_SIGNAL_CANONICAL_FIELDS,
  REQUIRED_PROVIDER_CANONICAL_FIELDS,
} from "../provider-mapping-contract";
import {
  parseDelimitedLine,
  type TokenizedCsv,
  tokenizeCsv,
} from "./csv-tokenizer";
import { normalizeHeader } from "./header-normalization";
import type {
  CanonicalField,
  ProviderMappingDefinition,
} from "./mapping-definition";
import { applyTransforms } from "./transforms";

export type AdapterDetectionCandidate = {
  providerId: string;
  providerName: string;
  requiredMatches: number;
  requiredTotal: number;
  patternMatches: number;
  score: number;
  matchedHeaders: string[];
};

/**
 * A provider adapter is compiled from one provider mapping definition. It
 * owns CSV lexical behavior, header normalization, detection scoring,
 * source-to-canonical field extraction, supported value transforms, and
 * canonical parser diagnostics for that one provider. Detection and parsing
 * both run against the same compiled adapter and the same tokenized CSV
 * representation, so a provider reported as a certain match is guaranteed to
 * be parseable by the same rules that scored it.
 */
export type ProviderAdapter = {
  id: string;
  providerName: string;
  mappingVersion: number;
  detect(csv: TokenizedCsv): AdapterDetectionCandidate;
  parse(csvContent: string): CsvParserResult;
};

function isReservedBookingDate(value: string): boolean {
  return value.trim().toLowerCase() === "reservert";
}

function parseAmount(raw: string, decimalSeparator: "," | "."): number | null {
  const thousandsSeparator = decimalSeparator === "," ? "." : ",";
  const withoutThousands = raw
    .replaceAll(/\s/g, "")
    .split(thousandsSeparator)
    .join("");
  const normalized =
    decimalSeparator === ","
      ? withoutThousands.replace(",", ".")
      : withoutThousands;
  const numeric = Number.parseFloat(normalized);

  return Number.isFinite(numeric) ? numeric : null;
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
    summary: { imported: 0, duplicates: 0, ignoredReserved: 0, invalid: 1 },
  };
}

function resolveDetectionHeaders(definition: ProviderMappingDefinition): {
  required: string[];
  any: string[];
  patterns: string[];
} {
  const { normalizationRules, fieldMappings } = definition;
  const required =
    normalizationRules.requiredHeaders &&
    normalizationRules.requiredHeaders.length > 0
      ? normalizationRules.requiredHeaders
      : fieldMappings.map((fieldMapping) => fieldMapping.sourceField);

  return {
    required,
    any: normalizationRules.anyHeaders ?? [],
    patterns: normalizationRules.headerPatterns ?? [],
  };
}

/**
 * Compiles one validated provider mapping definition into an executable
 * adapter.
 */
export function compileProviderAdapter(
  definition: ProviderMappingDefinition,
): ProviderAdapter {
  const { required, any, patterns } = resolveDetectionHeaders(definition);
  const normalizedRequiredHeaders = required.map((header) =>
    normalizeHeader(header),
  );
  const normalizedAnyHeaders = any.map((header) => normalizeHeader(header));
  const compiledPatterns = patterns.map((pattern) => new RegExp(pattern, "i"));

  function detect(csv: TokenizedCsv): AdapterDetectionCandidate {
    const headerSet = new Set(
      csv.headerCells.map((cell) => normalizeHeader(cell)),
    );
    const requiredMatches = normalizedRequiredHeaders.filter((header) =>
      headerSet.has(header),
    );
    const anyMatches = normalizedAnyHeaders.filter((header) =>
      headerSet.has(header),
    );
    const requiredCoverage =
      normalizedRequiredHeaders.length === 0
        ? 0
        : requiredMatches.length / normalizedRequiredHeaders.length;
    const anyCoverage =
      normalizedAnyHeaders.length === 0
        ? 0
        : anyMatches.length / normalizedAnyHeaders.length;
    const patternMatches = compiledPatterns.filter((pattern) =>
      pattern.test(csv.headerLine),
    ).length;

    const score = Number(
      (requiredCoverage + anyCoverage * 0.5 + patternMatches * 0.25).toFixed(4),
    );

    return {
      providerId: definition.id,
      providerName: definition.providerName,
      requiredMatches: requiredMatches.length,
      requiredTotal: normalizedRequiredHeaders.length,
      patternMatches,
      score,
      matchedHeaders: [...requiredMatches, ...anyMatches],
    };
  }

  function parse(csvContent: string): CsvParserResult {
    const explicitDelimiter = definition.normalizationRules.delimiter;
    const csv = tokenizeCsv(csvContent, explicitDelimiter);

    if (!csv) {
      return missingHeadersResult(definition.providerName);
    }

    const normalizedHeaderCells = csv.headerCells.map((cell) =>
      normalizeHeader(cell),
    );
    const fieldIndexByCanonical = new Map<CanonicalField, number>();
    const transformsByCanonical = new Map(
      definition.fieldMappings.map((fieldMapping) => [
        fieldMapping.canonicalField,
        fieldMapping.transformRules,
      ]),
    );

    for (const fieldMapping of definition.fieldMappings) {
      if (fieldIndexByCanonical.has(fieldMapping.canonicalField)) {
        continue;
      }
      const index = normalizedHeaderCells.indexOf(
        normalizeHeader(fieldMapping.sourceField),
      );
      if (index !== -1) {
        fieldIndexByCanonical.set(fieldMapping.canonicalField, index);
      }
    }

    const hasAllRequired = REQUIRED_PROVIDER_CANONICAL_FIELDS.every((field) =>
      fieldIndexByCanonical.has(field),
    );
    const hasMerchantSignal = MERCHANT_SIGNAL_CANONICAL_FIELDS.some((field) =>
      fieldIndexByCanonical.has(field),
    );

    if (!hasAllRequired || !hasMerchantSignal) {
      return missingHeadersResult(definition.providerName);
    }

    const decimalSeparator =
      definition.normalizationRules.decimalSeparator ?? ",";

    function extract(cells: string[], field: CanonicalField): string {
      const index = fieldIndexByCanonical.get(field);
      const raw = index === undefined ? "" : (cells[index] ?? "");
      return applyTransforms(raw, transformsByCanonical.get(field) ?? []);
    }

    const rows: ParsedCsvRow[] = [];
    const errors: CsvValidationError[] = [];
    let ignoredReserved = 0;

    for (let index = 0; index < csv.dataLines.length; index += 1) {
      const rowNumber = index + 2;
      const cells = parseDelimitedLine(csv.dataLines[index], csv.delimiter);

      const bookingDate = extract(cells, "bookingDate");
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

      const amountValue = extract(cells, "amount");
      const amountNok = parseAmount(amountValue, decimalSeparator);
      if (amountNok === null) {
        errors.push({
          rowNumber,
          code: "INVALID_AMOUNT",
          message: `Row ${rowNumber} has invalid amount "${amountValue}". Expected decimal format using "${decimalSeparator}" as the separator.`,
        });
        continue;
      }

      const hasCurrencyMapping = fieldIndexByCanonical.has("currency");
      const currencyValue = hasCurrencyMapping
        ? extract(cells, "currency").toUpperCase()
        : "NOK";
      if (currencyValue !== "NOK") {
        errors.push({
          rowNumber,
          code: "INVALID_CURRENCY",
          message: `Row ${rowNumber} has unsupported currency "${currencyValue}". Only NOK is accepted.`,
        });
        continue;
      }

      rows.push({
        bookingDate,
        amountNok,
        currency: "NOK",
        sender: extract(cells, "sender"),
        recipient: extract(cells, "recipient"),
        name: extract(cells, "name"),
        title: extract(cells, "title"),
        paymentType: extract(cells, "paymentType"),
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
    id: definition.id,
    providerName: definition.providerName,
    mappingVersion: definition.mappingVersion,
    detect,
    parse,
  };
}

import {
  type CsvDelimiter,
  SUPPORTED_CSV_DELIMITERS,
} from "../../lib/import/provider-adapter/csv-tokenizer";
import {
  SUPPORTED_DATE_FORMATS,
  SUPPORTED_DECIMAL_SEPARATORS,
  type SupportedDateFormat,
  type SupportedDecimalSeparator,
} from "../../lib/import/provider-adapter/mapping-definition";
import {
  PROVIDER_CANONICAL_FIELDS,
  REQUIRED_PROVIDER_CANONICAL_FIELDS,
} from "../../lib/import/provider-mapping-contract";

export type EditableFieldMapping = {
  sourceField: string;
  canonicalField: string;
};

export {
  SUPPORTED_CSV_DELIMITERS,
  SUPPORTED_DATE_FORMATS,
  SUPPORTED_DECIMAL_SEPARATORS,
};

export type NormalizationFormState = {
  requiredHeaders: string[];
  anyHeaders: string[];
  headerPatterns: string[];
  delimiter: CsvDelimiter | undefined;
  decimalSeparator: SupportedDecimalSeparator | undefined;
  dateFormat: SupportedDateFormat | undefined;
};

export const MERCHANT_SIGNAL_CANONICAL_FIELDS = ["name", "title"] as const;
export type MerchantSignalCanonicalField =
  (typeof MERCHANT_SIGNAL_CANONICAL_FIELDS)[number];
export const DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD: MerchantSignalCanonicalField =
  "title";
export const OPTIONAL_CANONICAL_FIELDS = PROVIDER_CANONICAL_FIELDS.filter(
  (field) =>
    !REQUIRED_PROVIDER_CANONICAL_FIELDS.includes(
      field as (typeof REQUIRED_PROVIDER_CANONICAL_FIELDS)[number],
    ),
);
export const DEFAULT_OPTIONAL_CANONICAL_FIELD = "sender";

const DEFAULT_REQUIRED_FIELD_MAPPINGS: EditableFieldMapping[] = [
  {
    sourceField: "",
    canonicalField: "bookingDate",
  },
  {
    sourceField: "",
    canonicalField: "amount",
  },
  {
    sourceField: "",
    canonicalField: DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD,
  },
];

export function createEmptyFieldMapping(): EditableFieldMapping {
  return {
    sourceField: "",
    canonicalField: DEFAULT_OPTIONAL_CANONICAL_FIELD,
  };
}

export function isRequiredCanonicalField(canonicalField: string): boolean {
  return REQUIRED_PROVIDER_CANONICAL_FIELDS.includes(
    canonicalField as (typeof REQUIRED_PROVIDER_CANONICAL_FIELDS)[number],
  );
}

export function isMerchantSignalCanonicalField(
  canonicalField: string,
): canonicalField is MerchantSignalCanonicalField {
  return MERCHANT_SIGNAL_CANONICAL_FIELDS.includes(
    canonicalField as MerchantSignalCanonicalField,
  );
}

export function getMappingSourceValue(
  fieldMappings: EditableFieldMapping[],
  canonicalField: string,
): string {
  return (
    fieldMappings.find((mapping) => mapping.canonicalField === canonicalField)
      ?.sourceField ?? ""
  );
}

export function upsertMappingValue(
  fieldMappings: EditableFieldMapping[],
  canonicalField: string,
  sourceField: string,
): EditableFieldMapping[] {
  const mappingIndex = fieldMappings.findIndex(
    (mapping) => mapping.canonicalField === canonicalField,
  );

  if (mappingIndex === -1) {
    return [...fieldMappings, { canonicalField, sourceField }];
  }

  return fieldMappings.map((mapping, index) =>
    index === mappingIndex ? { ...mapping, sourceField } : mapping,
  );
}

export function removeMappingByIndex(
  fieldMappings: EditableFieldMapping[],
  indexToRemove: number,
): EditableFieldMapping[] {
  return fieldMappings.filter((_, index) => index !== indexToRemove);
}

export function ensureRequiredFieldMappings(
  fieldMappings: EditableFieldMapping[],
  merchantSignalCanonicalField: MerchantSignalCanonicalField,
): EditableFieldMapping[] {
  let nextMappings = [...fieldMappings];

  for (const requiredField of REQUIRED_PROVIDER_CANONICAL_FIELDS) {
    nextMappings = upsertMappingValue(
      nextMappings,
      requiredField,
      getMappingSourceValue(nextMappings, requiredField),
    );
  }

  nextMappings = upsertMappingValue(
    nextMappings,
    merchantSignalCanonicalField,
    getMappingSourceValue(nextMappings, merchantSignalCanonicalField),
  );

  return nextMappings;
}

export function buildDefaultRequiredFieldMappings(): EditableFieldMapping[] {
  return DEFAULT_REQUIRED_FIELD_MAPPINGS.map((fieldMapping) => ({
    sourceField: fieldMapping.sourceField,
    canonicalField: fieldMapping.canonicalField,
  }));
}

export function createEmptyNormalizationFormState(): NormalizationFormState {
  return {
    requiredHeaders: [],
    anyHeaders: [],
    headerPatterns: [],
    delimiter: undefined,
    decimalSeparator: undefined,
    dateFormat: undefined,
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseEnumValue<T extends string>(
  value: unknown,
  allowed: ReadonlyArray<T>,
): T | undefined {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * Parses a persisted mapping's normalizationRules JSON into form state
 * covering only the closed rule vocabulary. Unlike the pre-adapter form,
 * unrecognized keys are dropped rather than round-tripped, so the admin UI
 * cannot resurrect rules the runtime compiler will reject.
 */
export function parseNormalizationFormState(
  value: unknown,
): NormalizationFormState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyNormalizationFormState();
  }

  const rules = value as Record<string, unknown>;

  return {
    requiredHeaders: parseStringArray(rules.requiredHeaders),
    anyHeaders: parseStringArray(rules.anyHeaders),
    headerPatterns: parseStringArray(rules.headerPatterns),
    delimiter: parseEnumValue(rules.delimiter, SUPPORTED_CSV_DELIMITERS),
    decimalSeparator: parseEnumValue(
      rules.decimalSeparator,
      SUPPORTED_DECIMAL_SEPARATORS,
    ),
    dateFormat: parseEnumValue(rules.dateFormat, SUPPORTED_DATE_FORMATS),
  };
}

export function buildNormalizationRulesPayload(
  state: NormalizationFormState,
): unknown {
  const payload: Record<string, unknown> = {};

  if (state.requiredHeaders.length > 0) {
    payload.requiredHeaders = state.requiredHeaders;
  }
  if (state.anyHeaders.length > 0) {
    payload.anyHeaders = state.anyHeaders;
  }
  if (state.headerPatterns.length > 0) {
    payload.headerPatterns = state.headerPatterns;
  }
  if (state.delimiter) {
    payload.delimiter = state.delimiter;
  }
  if (state.decimalSeparator) {
    payload.decimalSeparator = state.decimalSeparator;
  }
  if (state.dateFormat) {
    payload.dateFormat = state.dateFormat;
  }

  return payload;
}

export function mergeStringList(values: string[], candidate: string): string[] {
  const normalized = candidate.trim();
  if (!normalized) {
    return values;
  }

  const exists = values.some((value) => value === normalized);
  if (exists) {
    return values;
  }

  return [...values, normalized];
}

export function removeStringListValue(
  values: string[],
  candidate: string,
): string[] {
  return values.filter((value) => value !== candidate);
}

export function validateRegexPattern(value: string): string | null {
  try {
    // Validate regex syntax so headerPatterns are actionable in detection.
    new RegExp(value);
    return null;
  } catch {
    return "Pattern is not valid regex syntax.";
  }
}

export function parseMappingVersion(
  value: string,
): { value: number | undefined } | { error: string } {
  const trimmed = value.trim();

  if (!trimmed) {
    return { value: undefined };
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: "Mapping version must be a positive integer." };
  }

  return { value: parsed };
}

export function validateFieldMappings(fieldMappings: EditableFieldMapping[]) {
  const bookingDateSource = getMappingSourceValue(fieldMappings, "bookingDate");
  if (!bookingDateSource.trim()) {
    return "Required mapping is missing source field for bookingDate.";
  }

  const amountSource = getMappingSourceValue(fieldMappings, "amount");
  if (!amountSource.trim()) {
    return "Required mapping is missing source field for amount.";
  }

  const hasMerchantSignal = MERCHANT_SIGNAL_CANONICAL_FIELDS.some((field) =>
    getMappingSourceValue(fieldMappings, field).trim(),
  );
  if (!hasMerchantSignal) {
    return "Required merchant signal mapping is missing (name or title).";
  }

  const optionalRows = fieldMappings.filter(
    (fieldMapping) =>
      !isRequiredCanonicalField(fieldMapping.canonicalField) &&
      !isMerchantSignalCanonicalField(fieldMapping.canonicalField),
  );

  for (const [index, fieldMapping] of optionalRows.entries()) {
    if (!fieldMapping.sourceField.trim()) {
      return `Optional mapping source field is required for row ${index + 1}.`;
    }

    if (!fieldMapping.canonicalField.trim()) {
      return `Optional mapping canonical field is required for row ${index + 1}.`;
    }
  }

  const canonicalFields = fieldMappings
    .map((fieldMapping) => fieldMapping.canonicalField.trim())
    .filter((canonicalField) => canonicalField.length > 0);
  const uniqueCanonicalFields = new Set(canonicalFields);
  if (uniqueCanonicalFields.size !== canonicalFields.length) {
    return "Each canonical field can only be mapped once.";
  }

  return null;
}

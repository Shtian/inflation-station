import type { CsvDelimiter } from "../../lib/import/provider-adapter/csv-statement";
import {
  PROVIDER_FIELD_TRANSFORM_TYPES,
  type ProviderDateFormat,
  type ProviderDecimalSeparator,
  type ProviderFieldTransform,
  type ProviderFieldTransformType,
  SUPPORTED_PROVIDER_DATE_FORMATS,
  SUPPORTED_PROVIDER_DECIMAL_SEPARATORS,
  SUPPORTED_PROVIDER_DELIMITERS,
} from "../../lib/import/provider-adapter/mapping-definition";
import {
  PROVIDER_CANONICAL_FIELDS,
  REQUIRED_PROVIDER_CANONICAL_FIELDS,
} from "../../lib/import/provider-mapping-contract";

export type EditableFieldMapping = {
  sourceField: string;
  canonicalField: string;
  transforms: ProviderFieldTransform[];
};

/** Selecting this delimiter option omits `delimiter` from the payload, so the
 * compiler infers it from the statement (`ProviderMappingDefinition.delimiter === null`). */
export const INFER_DELIMITER_OPTION = "infer" as const;

export type NormalizationFormState = {
  delimiter: CsvDelimiter | typeof INFER_DELIMITER_OPTION;
  decimalSeparator: ProviderDecimalSeparator;
  dateFormat: ProviderDateFormat;
  requiredHeaders: string[];
  anyHeaders: string[];
  headerPatterns: string[];
};

export const DEFAULT_DECIMAL_SEPARATOR: ProviderDecimalSeparator = ",";
export const DEFAULT_DATE_FORMAT: ProviderDateFormat = "DD.MM.YYYY";

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
    transforms: [],
  },
  {
    sourceField: "",
    canonicalField: "amount",
    transforms: [],
  },
  {
    sourceField: "",
    canonicalField: DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD,
    transforms: [],
  },
];

export function createEmptyFieldMapping(): EditableFieldMapping {
  return {
    sourceField: "",
    canonicalField: DEFAULT_OPTIONAL_CANONICAL_FIELD,
    transforms: [],
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

export function getMappingTransforms(
  fieldMappings: EditableFieldMapping[],
  canonicalField: string,
): ProviderFieldTransform[] {
  return (
    fieldMappings.find((mapping) => mapping.canonicalField === canonicalField)
      ?.transforms ?? []
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
    return [...fieldMappings, { canonicalField, sourceField, transforms: [] }];
  }

  return fieldMappings.map((mapping, index) =>
    index === mappingIndex ? { ...mapping, sourceField } : mapping,
  );
}

export function upsertMappingTransforms(
  fieldMappings: EditableFieldMapping[],
  canonicalField: string,
  transforms: ProviderFieldTransform[],
): EditableFieldMapping[] {
  const mappingIndex = fieldMappings.findIndex(
    (mapping) => mapping.canonicalField === canonicalField,
  );

  if (mappingIndex === -1) {
    return [...fieldMappings, { canonicalField, sourceField: "", transforms }];
  }

  return fieldMappings.map((mapping, index) =>
    index === mappingIndex ? { ...mapping, transforms } : mapping,
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
    transforms: [],
  }));
}

export function createEmptyNormalizationFormState(): NormalizationFormState {
  return {
    delimiter: INFER_DELIMITER_OPTION,
    decimalSeparator: DEFAULT_DECIMAL_SEPARATOR,
    dateFormat: DEFAULT_DATE_FORMAT,
    requiredHeaders: [],
    anyHeaders: [],
    headerPatterns: [],
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

/**
 * Parses persisted normalizationRules JSON into the closed v1 rule set the form
 * exposes. Any unrecognized key (the old `extraRules` passthrough, `encoding`,
 * or any other legacy key) is dropped rather than round-tripped, and any value
 * outside the active version's supported set falls back to the compiler's own
 * default so the form never displays a rule the runtime cannot execute.
 */
export function parseNormalizationFormState(
  value: unknown,
): NormalizationFormState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyNormalizationFormState();
  }

  const rules = value as Record<string, unknown>;

  const delimiter =
    typeof rules.delimiter === "string" &&
    (SUPPORTED_PROVIDER_DELIMITERS as readonly string[]).includes(
      rules.delimiter,
    )
      ? (rules.delimiter as CsvDelimiter)
      : INFER_DELIMITER_OPTION;

  const decimalSeparator =
    typeof rules.decimalSeparator === "string" &&
    (SUPPORTED_PROVIDER_DECIMAL_SEPARATORS as readonly string[]).includes(
      rules.decimalSeparator,
    )
      ? (rules.decimalSeparator as ProviderDecimalSeparator)
      : DEFAULT_DECIMAL_SEPARATOR;

  const dateFormat =
    typeof rules.dateFormat === "string" &&
    (SUPPORTED_PROVIDER_DATE_FORMATS as readonly string[]).includes(
      rules.dateFormat,
    )
      ? (rules.dateFormat as ProviderDateFormat)
      : DEFAULT_DATE_FORMAT;

  return {
    delimiter,
    decimalSeparator,
    dateFormat,
    requiredHeaders: parseStringArray(rules.requiredHeaders),
    anyHeaders: parseStringArray(rules.anyHeaders),
    headerPatterns: parseStringArray(rules.headerPatterns),
  };
}

export function buildNormalizationRulesPayload(
  state: NormalizationFormState,
): unknown {
  const payload: Record<string, unknown> = {
    decimalSeparator: state.decimalSeparator,
    dateFormat: state.dateFormat,
  };

  if (state.delimiter !== INFER_DELIMITER_OPTION) {
    payload.delimiter = state.delimiter;
  }

  if (state.requiredHeaders.length > 0) {
    payload.requiredHeaders = state.requiredHeaders;
  }
  if (state.anyHeaders.length > 0) {
    payload.anyHeaders = state.anyHeaders;
  }
  if (state.headerPatterns.length > 0) {
    payload.headerPatterns = state.headerPatterns;
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

function isValidFieldTransform(
  entry: unknown,
): entry is ProviderFieldTransform {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return false;
  }

  const type = (entry as { type?: unknown }).type;
  if (
    typeof type !== "string" ||
    !(PROVIDER_FIELD_TRANSFORM_TYPES as readonly string[]).includes(type)
  ) {
    return false;
  }

  const transformType = type as ProviderFieldTransformType;

  if (transformType === "applySign") {
    const sign = (entry as { sign?: unknown }).sign;
    return sign === "negative" || sign === "positive";
  }

  if (transformType === "mapValues") {
    const values = (entry as { values?: unknown }).values;
    const fallback = (entry as { fallback?: unknown }).fallback;

    if (
      typeof values !== "object" ||
      values === null ||
      Array.isArray(values)
    ) {
      return false;
    }

    const valuesRecord = values as Record<string, unknown>;
    const hasOnlyStringValues = Object.values(valuesRecord).every(
      (candidate) => typeof candidate === "string",
    );

    return (
      hasOnlyStringValues &&
      (fallback === undefined || typeof fallback === "string")
    );
  }

  // trim / uppercase / lowercase carry no parameters.
  return true;
}

/**
 * Parses persisted transformRules JSON into the closed v1 transform vocabulary.
 * Unknown transform types and malformed transform parameters are dropped rather
 * than round-tripped, matching parseNormalizationFormState's behavior for
 * normalization rules.
 */
export function parseFieldTransforms(value: unknown): ProviderFieldTransform[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isValidFieldTransform);
}

export function describeFieldTransform(
  transform: ProviderFieldTransform,
): string {
  switch (transform.type) {
    case "trim":
      return "Trim";
    case "uppercase":
      return "Uppercase";
    case "lowercase":
      return "Lowercase";
    case "applySign":
      return `Apply sign: ${transform.sign}`;
    case "mapValues": {
      const count = Object.keys(transform.values).length;
      const fallback = transform.fallback
        ? `, fallback "${transform.fallback}"`
        : "";
      return `Map ${count} value${count === 1 ? "" : "s"}${fallback}`;
    }
    default: {
      const exhaustiveCheck: never = transform;
      return exhaustiveCheck;
    }
  }
}

/**
 * Parses the mapValues draft textarea ("from=to" per line) into the transform's
 * `values` record. Kept small and explicit rather than a dynamic key/value row
 * editor: a malformed line is a validation error, not a silently dropped entry.
 */
export function parseMapValuesLines(
  text: string,
): { values: Record<string, string> } | { error: string } {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { error: 'Add at least one "from=to" value mapping.' };
  }

  const values: Record<string, string> = {};
  for (const line of lines) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === line.length - 1) {
      return {
        error: `Each line must be "from=to". Invalid line: "${line}".`,
      };
    }

    const from = line.slice(0, separatorIndex).trim();
    const to = line.slice(separatorIndex + 1).trim();
    if (!from || !to) {
      return {
        error: `Each line must be "from=to". Invalid line: "${line}".`,
      };
    }

    values[from] = to;
  }

  return { values };
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

  for (const fieldMapping of fieldMappings) {
    for (const transform of fieldMapping.transforms) {
      if (
        transform.type === "mapValues" &&
        Object.keys(transform.values).length === 0
      ) {
        return `Map values transform for "${fieldMapping.canonicalField}" needs at least one value mapping.`;
      }
    }
  }

  return null;
}

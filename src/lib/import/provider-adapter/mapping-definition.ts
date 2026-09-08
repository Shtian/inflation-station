import type { PROVIDER_CANONICAL_FIELDS } from "../provider-mapping-contract";
import type { CsvDelimiter } from "./csv-statement";

export const PROVIDER_MAPPING_VERSION = 1 as const;

export type ProviderCanonicalField = (typeof PROVIDER_CANONICAL_FIELDS)[number];

export type ProviderDateFormat = "YYYY-MM-DD" | "DD.MM.YYYY";

export type ProviderDecimalSeparator = "," | ".";

export const SUPPORTED_PROVIDER_DELIMITERS = [
  ";",
  ",",
] as const satisfies ReadonlyArray<CsvDelimiter>;

export const SUPPORTED_PROVIDER_DECIMAL_SEPARATORS = [
  ",",
  ".",
] as const satisfies ReadonlyArray<ProviderDecimalSeparator>;

export const SUPPORTED_PROVIDER_DATE_FORMATS = [
  "YYYY-MM-DD",
  "DD.MM.YYYY",
] as const satisfies ReadonlyArray<ProviderDateFormat>;

export const PROVIDER_FIELD_TRANSFORM_TYPES = [
  "trim",
  "uppercase",
  "lowercase",
  "mapValues",
  "applySign",
] as const;

export type ProviderFieldTransformType =
  (typeof PROVIDER_FIELD_TRANSFORM_TYPES)[number];

export type ProviderFieldTransform =
  | { type: "trim" }
  | { type: "uppercase" }
  | { type: "lowercase" }
  | { type: "mapValues"; values: Record<string, string>; fallback?: string }
  | { type: "applySign"; sign: "negative" | "positive" };

export type ProviderDetectionRules = {
  /** Raw, as configured. Empty when the mapping omits explicit required headers. */
  requiredHeaders: string[];
  anyHeaders: string[];
  /** Validated as regex at compile time (compiled with the "i" flag). */
  headerPatterns: string[];
};

export type ProviderFieldDefinition = {
  canonicalField: ProviderCanonicalField;
  sourceField: string;
  normalizedSourceHeader: string;
  transforms: ProviderFieldTransform[];
};

export type ProviderMappingDefinition = {
  providerId: string;
  providerName: string;
  mappingVersion: 1;
  /** null means "infer from the statement"; detection and parsing then resolve identically. */
  delimiter: CsvDelimiter | null;
  decimalSeparator: ProviderDecimalSeparator;
  dateFormat: ProviderDateFormat;
  detection: ProviderDetectionRules;
  fields: ProviderFieldDefinition[];
};

export type ProviderMappingConfigurationErrorCode =
  | "UNSUPPORTED_MAPPING_VERSION"
  | "INVALID_NORMALIZATION_RULES"
  | "UNKNOWN_NORMALIZATION_RULE"
  | "UNSUPPORTED_DELIMITER"
  | "UNSUPPORTED_DECIMAL_SEPARATOR"
  | "UNSUPPORTED_DATE_FORMAT"
  | "INVALID_HEADER_PATTERN"
  | "UNKNOWN_CANONICAL_FIELD"
  | "DUPLICATE_CANONICAL_FIELD"
  | "REQUIRED_CANONICAL_FIELDS_MISSING"
  | "MERCHANT_SIGNAL_FIELD_REQUIRED"
  | "SOURCE_FIELD_REQUIRED"
  | "UNSUPPORTED_FIELD_TRANSFORM"
  | "INVALID_FIELD_TRANSFORM";

export type ProviderMappingConfigurationError = {
  code: ProviderMappingConfigurationErrorCode;
  message: string;
  providerName: string | null;
  details?: Record<string, unknown>;
};

export type ProviderMappingRecord = {
  id: string;
  providerName: string;
  mappingVersion: number | null;
  normalizationRules: unknown;
  fieldMappings: ReadonlyArray<{
    sourceField: string;
    canonicalField: string;
    transformRules: unknown;
  }>;
};

export type CompileProviderMappingResult =
  | { ok: true; definition: ProviderMappingDefinition }
  | { ok: false; error: ProviderMappingConfigurationError };

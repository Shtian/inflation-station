import { z } from "zod";
import {
  findMissingRequiredCanonicalFields,
  hasMerchantSignalCanonicalField,
  PROVIDER_CANONICAL_FIELDS,
} from "../provider-mapping-contract";
import { SUPPORTED_CSV_DELIMITERS } from "./csv-tokenizer";
import type { TransformRule } from "./transforms";
import { transformRuleSchema } from "./transforms";

export type CanonicalField = (typeof PROVIDER_CANONICAL_FIELDS)[number];

export const SUPPORTED_MAPPING_VERSIONS = [1] as const;

export const SUPPORTED_DECIMAL_SEPARATORS = [",", "."] as const;
export type SupportedDecimalSeparator =
  (typeof SUPPORTED_DECIMAL_SEPARATORS)[number];

export const SUPPORTED_DATE_FORMATS = ["DD.MM.YYYY", "YYYY-MM-DD"] as const;
export type SupportedDateFormat = (typeof SUPPORTED_DATE_FORMATS)[number];

const regexPatternSchema = z
  .string()
  .min(1)
  .refine(
    (pattern) => {
      try {
        // eslint-disable-next-line no-new
        new RegExp(pattern, "i");
        return true;
      } catch {
        return false;
      }
    },
    { message: "Header pattern is not a valid regular expression." },
  );

/**
 * The first executable mapping version's closed normalization-rule
 * vocabulary: delimiter, decimal separator, date format, required headers,
 * optional-any headers, and header regular expressions. Any other key
 * (including `encoding`, which implies unsupported behavior, and any
 * previously-preserved `extraRules`) is rejected rather than silently kept.
 */
export const normalizationRulesSchema = z
  .object({
    delimiter: z.enum(SUPPORTED_CSV_DELIMITERS).optional(),
    decimalSeparator: z.enum(SUPPORTED_DECIMAL_SEPARATORS).optional(),
    dateFormat: z.enum(SUPPORTED_DATE_FORMATS).optional(),
    requiredHeaders: z.array(z.string().min(1)).optional(),
    anyHeaders: z.array(z.string().min(1)).optional(),
    headerPatterns: z.array(regexPatternSchema).optional(),
  })
  .strict();

export type NormalizationRules = z.infer<typeof normalizationRulesSchema>;

export const fieldMappingRecordSchema = z.object({
  sourceField: z.string().trim().min(1),
  canonicalField: z.enum(PROVIDER_CANONICAL_FIELDS),
  transformRules: z.array(transformRuleSchema).optional(),
});

export type CompiledFieldMapping = {
  sourceField: string;
  canonicalField: CanonicalField;
  transformRules: TransformRule[];
};

export type ProviderMappingDefinition = {
  id: string;
  providerName: string;
  mappingVersion: number;
  normalizationRules: NormalizationRules;
  fieldMappings: CompiledFieldMapping[];
};

export type ProviderMappingRecord = {
  id: string;
  providerName: string;
  mappingVersion: number;
  normalizationRules: unknown;
  fieldMappings: ReadonlyArray<{
    sourceField: string;
    canonicalField: string;
    transformRules?: unknown;
  }>;
};

export type MappingCompilationErrorCode =
  | "UNSUPPORTED_MAPPING_VERSION"
  | "INVALID_NORMALIZATION_RULES"
  | "INVALID_FIELD_MAPPING"
  | "DUPLICATE_CANONICAL_FIELD"
  | "MISSING_REQUIRED_CANONICAL_FIELDS"
  | "MISSING_MERCHANT_SIGNAL_FIELD";

export class ProviderMappingCompilationError extends Error {
  readonly code: MappingCompilationErrorCode;
  readonly providerName: string;
  readonly details?: unknown;

  constructor(
    code: MappingCompilationErrorCode,
    providerName: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ProviderMappingCompilationError";
    this.code = code;
    this.providerName = providerName;
    this.details = details;
  }
}

function findDuplicates(values: ReadonlyArray<string>): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

/**
 * Validates and compiles a persisted-shape provider mapping record into the
 * validated domain representation used everywhere else in the adapter
 * pipeline. This is the one seam mapping create/update mutations and runtime
 * loading both compile through, so a mapping cannot appear configured while
 * being unusable at runtime.
 */
export function compileProviderMappingDefinition(
  record: ProviderMappingRecord,
): ProviderMappingDefinition {
  if (
    !(SUPPORTED_MAPPING_VERSIONS as readonly number[]).includes(
      record.mappingVersion,
    )
  ) {
    throw new ProviderMappingCompilationError(
      "UNSUPPORTED_MAPPING_VERSION",
      record.providerName,
      `Provider mapping "${record.providerName}" uses unsupported mapping version ${record.mappingVersion}.`,
    );
  }

  const normalizationResult = normalizationRulesSchema.safeParse(
    record.normalizationRules && typeof record.normalizationRules === "object"
      ? record.normalizationRules
      : {},
  );
  if (!normalizationResult.success) {
    throw new ProviderMappingCompilationError(
      "INVALID_NORMALIZATION_RULES",
      record.providerName,
      `Provider mapping "${record.providerName}" has invalid normalization rules.`,
      normalizationResult.error.flatten(),
    );
  }

  const fieldMappings: CompiledFieldMapping[] = [];
  for (const raw of record.fieldMappings) {
    const fieldResult = fieldMappingRecordSchema.safeParse({
      sourceField: raw.sourceField,
      canonicalField: raw.canonicalField,
      transformRules:
        raw.transformRules === null || raw.transformRules === undefined
          ? undefined
          : raw.transformRules,
    });

    if (!fieldResult.success) {
      throw new ProviderMappingCompilationError(
        "INVALID_FIELD_MAPPING",
        record.providerName,
        `Provider mapping "${record.providerName}" has an invalid field mapping for source "${raw.sourceField}".`,
        fieldResult.error.flatten(),
      );
    }

    fieldMappings.push({
      sourceField: fieldResult.data.sourceField,
      canonicalField: fieldResult.data.canonicalField,
      transformRules: fieldResult.data.transformRules ?? [],
    });
  }

  const canonicalFields = fieldMappings.map(
    (mapping) => mapping.canonicalField,
  );
  const duplicateCanonicalFields = findDuplicates(canonicalFields);
  if (duplicateCanonicalFields.length > 0) {
    throw new ProviderMappingCompilationError(
      "DUPLICATE_CANONICAL_FIELD",
      record.providerName,
      `Provider mapping "${record.providerName}" maps the same canonical field more than once: ${duplicateCanonicalFields.join(", ")}.`,
      { duplicateCanonicalFields },
    );
  }

  const missingRequiredFields =
    findMissingRequiredCanonicalFields(canonicalFields);
  if (missingRequiredFields.length > 0) {
    throw new ProviderMappingCompilationError(
      "MISSING_REQUIRED_CANONICAL_FIELDS",
      record.providerName,
      `Provider mapping "${record.providerName}" is missing required canonical fields: ${missingRequiredFields.join(", ")}.`,
      { missingRequiredFields },
    );
  }

  if (!hasMerchantSignalCanonicalField(canonicalFields)) {
    throw new ProviderMappingCompilationError(
      "MISSING_MERCHANT_SIGNAL_FIELD",
      record.providerName,
      `Provider mapping "${record.providerName}" must map at least one merchant signal field (name or title).`,
    );
  }

  return {
    id: record.id,
    providerName: record.providerName,
    mappingVersion: record.mappingVersion,
    normalizationRules: normalizationResult.data,
    fieldMappings,
  };
}

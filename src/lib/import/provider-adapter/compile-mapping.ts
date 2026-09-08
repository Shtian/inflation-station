import { z } from "zod";
import {
  findMissingRequiredCanonicalFields,
  hasMerchantSignalCanonicalField,
  PROVIDER_CANONICAL_FIELDS,
} from "../provider-mapping-contract";
import type { CsvDelimiter } from "./csv-statement";
import { normalizeCsvHeader } from "./csv-statement";
import {
  type CompileProviderMappingResult,
  PROVIDER_FIELD_TRANSFORM_TYPES,
  PROVIDER_MAPPING_VERSION,
  type ProviderCanonicalField,
  type ProviderDateFormat,
  type ProviderDecimalSeparator,
  type ProviderDetectionRules,
  type ProviderFieldDefinition,
  type ProviderFieldTransform,
  type ProviderFieldTransformType,
  type ProviderMappingConfigurationError,
  type ProviderMappingConfigurationErrorCode,
  type ProviderMappingRecord,
  SUPPORTED_PROVIDER_DATE_FORMATS,
  SUPPORTED_PROVIDER_DECIMAL_SEPARATORS,
  SUPPORTED_PROVIDER_DELIMITERS,
} from "./mapping-definition";

const normalizationRulesShapeSchema = z.strictObject({
  delimiter: z.string().nullish(),
  decimalSeparator: z.string().nullish(),
  dateFormat: z.string().nullish(),
  requiredHeaders: z.array(z.string()).nullish(),
  anyHeaders: z.array(z.string()).nullish(),
  headerPatterns: z.array(z.string()).nullish(),
});

const trimTransformSchema = z.strictObject({ type: z.literal("trim") });
const uppercaseTransformSchema = z.strictObject({
  type: z.literal("uppercase"),
});
const lowercaseTransformSchema = z.strictObject({
  type: z.literal("lowercase"),
});
const mapValuesTransformSchema = z.strictObject({
  type: z.literal("mapValues"),
  values: z.record(z.string(), z.string()),
  fallback: z.string().optional(),
});
const applySignTransformSchema = z.strictObject({
  type: z.literal("applySign"),
  sign: z.enum(["negative", "positive"]),
});

const FIELD_TRANSFORM_SCHEMAS_BY_TYPE: Record<
  ProviderFieldTransformType,
  z.ZodType<ProviderFieldTransform>
> = {
  trim: trimTransformSchema,
  uppercase: uppercaseTransformSchema,
  lowercase: lowercaseTransformSchema,
  mapValues: mapValuesTransformSchema,
  applySign: applySignTransformSchema,
};

type CompileFailure = { ok: false; error: ProviderMappingConfigurationError };

function makeError(
  code: ProviderMappingConfigurationErrorCode,
  message: string,
  providerName: string | null,
  details?: Record<string, unknown>,
): ProviderMappingConfigurationError {
  return details === undefined
    ? { code, message, providerName }
    : { code, message, providerName, details };
}

function makeFailure(
  code: ProviderMappingConfigurationErrorCode,
  message: string,
  providerName: string | null,
  details?: Record<string, unknown>,
): CompileFailure {
  return { ok: false, error: makeError(code, message, providerName, details) };
}

function isProviderCanonicalField(
  value: string,
): value is ProviderCanonicalField {
  return (PROVIDER_CANONICAL_FIELDS as readonly string[]).includes(value);
}

type CompiledNormalizationRules = {
  delimiter: CsvDelimiter | null;
  decimalSeparator: ProviderDecimalSeparator;
  dateFormat: ProviderDateFormat;
  detection: ProviderDetectionRules;
};

function compileNormalizationRules(
  rawNormalizationRules: unknown,
  providerName: string,
): { ok: true; value: CompiledNormalizationRules } | CompileFailure {
  const candidate = rawNormalizationRules ?? {};

  if (typeof candidate !== "object" || Array.isArray(candidate)) {
    return makeFailure(
      "INVALID_NORMALIZATION_RULES",
      "Normalization rules must be a JSON object.",
      providerName,
    );
  }

  const parsed = normalizationRulesShapeSchema.safeParse(candidate);
  if (!parsed.success) {
    const unrecognizedKeysIssue = parsed.error.issues.find(
      (issue) => issue.code === "unrecognized_keys",
    );
    if (unrecognizedKeysIssue && "keys" in unrecognizedKeysIssue) {
      return makeFailure(
        "UNKNOWN_NORMALIZATION_RULE",
        `Unknown normalization rule key(s): ${unrecognizedKeysIssue.keys.join(", ")}.`,
        providerName,
        { unknownKeys: unrecognizedKeysIssue.keys },
      );
    }

    return makeFailure(
      "INVALID_NORMALIZATION_RULES",
      "Normalization rules failed shape validation.",
      providerName,
      { issues: parsed.error.issues.map((issue) => issue.message) },
    );
  }

  const rules = parsed.data;

  const delimiter = rules.delimiter ?? null;
  if (
    delimiter !== null &&
    !(SUPPORTED_PROVIDER_DELIMITERS as readonly string[]).includes(delimiter)
  ) {
    return makeFailure(
      "UNSUPPORTED_DELIMITER",
      `Unsupported delimiter "${delimiter}".`,
      providerName,
      { delimiter },
    );
  }

  const decimalSeparator = rules.decimalSeparator ?? ",";
  if (
    !(SUPPORTED_PROVIDER_DECIMAL_SEPARATORS as readonly string[]).includes(
      decimalSeparator,
    )
  ) {
    return makeFailure(
      "UNSUPPORTED_DECIMAL_SEPARATOR",
      `Unsupported decimal separator "${decimalSeparator}".`,
      providerName,
      { decimalSeparator },
    );
  }

  const dateFormat = rules.dateFormat ?? "DD.MM.YYYY";
  if (
    !(SUPPORTED_PROVIDER_DATE_FORMATS as readonly string[]).includes(dateFormat)
  ) {
    return makeFailure(
      "UNSUPPORTED_DATE_FORMAT",
      `Unsupported date format "${dateFormat}".`,
      providerName,
      { dateFormat },
    );
  }

  const headerPatterns = rules.headerPatterns ?? [];
  for (const pattern of headerPatterns) {
    try {
      new RegExp(pattern, "i");
    } catch {
      return makeFailure(
        "INVALID_HEADER_PATTERN",
        `Invalid header pattern "${pattern}".`,
        providerName,
        { pattern },
      );
    }
  }

  return {
    ok: true,
    value: {
      delimiter: delimiter as CsvDelimiter | null,
      decimalSeparator: decimalSeparator as ProviderDecimalSeparator,
      dateFormat: dateFormat as ProviderDateFormat,
      detection: {
        requiredHeaders: rules.requiredHeaders ?? [],
        anyHeaders: rules.anyHeaders ?? [],
        headerPatterns,
      },
    },
  };
}

function compileFieldTransform(
  entry: unknown,
  providerName: string,
  canonicalField: string,
  index: number,
): { ok: true; transform: ProviderFieldTransform } | CompileFailure {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return makeFailure(
      "INVALID_FIELD_TRANSFORM",
      `Malformed transform at index ${index} for canonical field "${canonicalField}".`,
      providerName,
      { canonicalField, index },
    );
  }

  const transformType = (entry as { type?: unknown }).type;
  if (typeof transformType !== "string") {
    return makeFailure(
      "INVALID_FIELD_TRANSFORM",
      `Transform at index ${index} for canonical field "${canonicalField}" is missing a "type".`,
      providerName,
      { canonicalField, index },
    );
  }

  if (
    !(PROVIDER_FIELD_TRANSFORM_TYPES as readonly string[]).includes(
      transformType,
    )
  ) {
    return makeFailure(
      "UNSUPPORTED_FIELD_TRANSFORM",
      `Unsupported transform type "${transformType}" for canonical field "${canonicalField}".`,
      providerName,
      { canonicalField, index, transformType },
    );
  }

  const schema =
    FIELD_TRANSFORM_SCHEMAS_BY_TYPE[
      transformType as ProviderFieldTransformType
    ];
  const parsed = schema.safeParse(entry);
  if (!parsed.success) {
    return makeFailure(
      "INVALID_FIELD_TRANSFORM",
      `Malformed "${transformType}" transform at index ${index} for canonical field "${canonicalField}".`,
      providerName,
      {
        canonicalField,
        index,
        issues: parsed.error.issues.map((issue) => issue.message),
      },
    );
  }

  return { ok: true, transform: parsed.data };
}

function compileFieldTransforms(
  rawTransformRules: unknown,
  providerName: string,
  canonicalField: string,
): { ok: true; transforms: ProviderFieldTransform[] } | CompileFailure {
  if (rawTransformRules === null || rawTransformRules === undefined) {
    return { ok: true, transforms: [] };
  }

  if (!Array.isArray(rawTransformRules)) {
    return makeFailure(
      "INVALID_FIELD_TRANSFORM",
      `Transform rules for canonical field "${canonicalField}" must be an array.`,
      providerName,
      { canonicalField },
    );
  }

  const transforms: ProviderFieldTransform[] = [];
  for (const [index, entry] of rawTransformRules.entries()) {
    const compiled = compileFieldTransform(
      entry,
      providerName,
      canonicalField,
      index,
    );
    if (!compiled.ok) {
      return compiled;
    }
    transforms.push(compiled.transform);
  }

  return { ok: true, transforms };
}

export function compileProviderMapping(
  record: ProviderMappingRecord,
): CompileProviderMappingResult {
  const providerName = record.providerName;

  if (
    record.mappingVersion !== null &&
    record.mappingVersion !== PROVIDER_MAPPING_VERSION
  ) {
    return makeFailure(
      "UNSUPPORTED_MAPPING_VERSION",
      `Unsupported mapping version "${record.mappingVersion}".`,
      providerName,
      { mappingVersion: record.mappingVersion },
    );
  }

  const normalizationRulesResult = compileNormalizationRules(
    record.normalizationRules,
    providerName,
  );
  if (!normalizationRulesResult.ok) {
    return normalizationRulesResult;
  }

  const fields: ProviderFieldDefinition[] = [];
  const seenCanonicalFields = new Set<string>();

  for (const fieldMapping of record.fieldMappings) {
    const { canonicalField } = fieldMapping;

    if (!isProviderCanonicalField(canonicalField)) {
      return makeFailure(
        "UNKNOWN_CANONICAL_FIELD",
        `Unknown canonical field "${canonicalField}".`,
        providerName,
        { canonicalField },
      );
    }

    if (seenCanonicalFields.has(canonicalField)) {
      return makeFailure(
        "DUPLICATE_CANONICAL_FIELD",
        `Canonical field "${canonicalField}" is mapped more than once.`,
        providerName,
        { canonicalField },
      );
    }
    seenCanonicalFields.add(canonicalField);

    const sourceField = fieldMapping.sourceField.trim();
    if (sourceField.length === 0) {
      return makeFailure(
        "SOURCE_FIELD_REQUIRED",
        `Source field is required for canonical field "${canonicalField}".`,
        providerName,
        { canonicalField },
      );
    }

    const transformsResult = compileFieldTransforms(
      fieldMapping.transformRules,
      providerName,
      canonicalField,
    );
    if (!transformsResult.ok) {
      return transformsResult;
    }

    fields.push({
      canonicalField,
      sourceField,
      normalizedSourceHeader: normalizeCsvHeader(sourceField),
      transforms: transformsResult.transforms,
    });
  }

  const canonicalFields = fields.map((field) => field.canonicalField);

  const missingCanonicalFields =
    findMissingRequiredCanonicalFields(canonicalFields);
  if (missingCanonicalFields.length > 0) {
    return makeFailure(
      "REQUIRED_CANONICAL_FIELDS_MISSING",
      `Missing required canonical field(s): ${missingCanonicalFields.join(", ")}.`,
      providerName,
      { missingCanonicalFields },
    );
  }

  if (!hasMerchantSignalCanonicalField(canonicalFields)) {
    return makeFailure(
      "MERCHANT_SIGNAL_FIELD_REQUIRED",
      "At least one merchant signal field mapping is required (name or title).",
      providerName,
    );
  }

  return {
    ok: true,
    definition: {
      providerId: record.id,
      providerName,
      mappingVersion: PROVIDER_MAPPING_VERSION,
      delimiter: normalizationRulesResult.value.delimiter,
      decimalSeparator: normalizationRulesResult.value.decimalSeparator,
      dateFormat: normalizationRulesResult.value.dateFormat,
      detection: normalizationRulesResult.value.detection,
      fields,
    },
  };
}

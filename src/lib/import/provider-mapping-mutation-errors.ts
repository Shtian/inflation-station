import type { ProviderMappingConfigurationError } from "./provider-adapter/mapping-definition";

export type ProviderMappingMutationErrorCode =
  | "DUPLICATE_CANONICAL_FIELD_MAPPINGS"
  | "REQUIRED_CANONICAL_FIELDS_MISSING"
  | "MERCHANT_SIGNAL_FIELD_REQUIRED"
  | "INVALID_PROVIDER_MAPPING_DEFINITION";

export type ProviderMappingMutationError =
  | {
      code: "DUPLICATE_CANONICAL_FIELD_MAPPINGS";
      message: string;
      duplicateCanonicalFields: string[];
    }
  | {
      code: "REQUIRED_CANONICAL_FIELDS_MISSING";
      message: string;
      missingCanonicalFields: string[];
    }
  | {
      code: "MERCHANT_SIGNAL_FIELD_REQUIRED";
      message: string;
    }
  | {
      code: "INVALID_PROVIDER_MAPPING_DEFINITION";
      message: string;
      configurationErrorCode: ProviderMappingConfigurationError["code"];
      details?: Record<string, unknown>;
    };

/**
 * Maps a compileProviderMapping diagnostic onto the stable wire error codes that
 * administration and existing callers already depend on. DUPLICATE_CANONICAL_FIELD,
 * REQUIRED_CANONICAL_FIELDS_MISSING and MERCHANT_SIGNAL_FIELD_REQUIRED keep their
 * pre-existing wire codes and payload fields. Every other compiler diagnostic
 * (unsupported versions, unknown normalization keys, invalid regex, unknown
 * canonical fields, empty source fields, malformed/unsupported transforms) becomes
 * one INVALID_PROVIDER_MAPPING_DEFINITION error carrying the compiler's own code,
 * message and details, so both mutation boundaries stay in lockstep with the runtime
 * compiler without hand-rolling a second copy of its vocabulary.
 */
export function toProviderMappingMutationError(
  error: ProviderMappingConfigurationError,
): ProviderMappingMutationError {
  if (error.code === "DUPLICATE_CANONICAL_FIELD") {
    const canonicalField = error.details?.canonicalField;
    return {
      code: "DUPLICATE_CANONICAL_FIELD_MAPPINGS",
      message: error.message,
      duplicateCanonicalFields:
        typeof canonicalField === "string" ? [canonicalField] : [],
    };
  }

  if (error.code === "REQUIRED_CANONICAL_FIELDS_MISSING") {
    const missingCanonicalFields = error.details?.missingCanonicalFields;
    return {
      code: "REQUIRED_CANONICAL_FIELDS_MISSING",
      message: error.message,
      missingCanonicalFields: Array.isArray(missingCanonicalFields)
        ? missingCanonicalFields.filter(
            (field): field is string => typeof field === "string",
          )
        : [],
    };
  }

  if (error.code === "MERCHANT_SIGNAL_FIELD_REQUIRED") {
    return { code: "MERCHANT_SIGNAL_FIELD_REQUIRED", message: error.message };
  }

  return {
    code: "INVALID_PROVIDER_MAPPING_DEFINITION",
    message: error.message,
    configurationErrorCode: error.code,
    details: error.details,
  };
}

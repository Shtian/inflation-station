"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isInputJsonValue } from "@/lib/import/json-value";
import { compileProviderMapping } from "@/lib/import/provider-adapter/compile-mapping";
import {
  type ProviderMappingMutationError,
  toProviderMappingMutationError,
} from "@/lib/import/provider-mapping-mutation-errors";
import { prisma } from "@/lib/prisma";
import {
  executeServerMutation,
  type MutationActionResult,
  mutationError,
  mutationValidationError,
} from "@/lib/server-actions/mutation-result";

const jsonValueSchema = z.custom<Prisma.InputJsonValue>(
  (value) => isInputJsonValue(value),
  "Expected a JSON-serializable value.",
);

const fieldMappingSchema = z.object({
  sourceField: z.string().trim().min(1),
  canonicalField: z.string().trim().min(1),
  transformRules: jsonValueSchema.optional(),
});

const createProviderMappingSchema = z.object({
  providerName: z.string().trim().min(1),
  fieldMappings: z.array(fieldMappingSchema).min(1),
  normalizationRules: jsonValueSchema.default({}),
  mappingVersion: z.number().int().positive().optional(),
});

type CreateProviderMappingActionErrorCode =
  | "INVALID_PROVIDER_MAPPING_PAYLOAD"
  | "DUPLICATE_CANONICAL_FIELD_MAPPINGS"
  | "REQUIRED_CANONICAL_FIELDS_MISSING"
  | "MERCHANT_SIGNAL_FIELD_REQUIRED"
  | "INVALID_PROVIDER_MAPPING_DEFINITION"
  | "PROVIDER_MAPPING_MUST_BE_UNIQUE"
  | "PROVIDER_MAPPING_CREATE_FAILED";

type CreateProviderMappingActionResult = MutationActionResult<
  { mappingId: string },
  CreateProviderMappingActionErrorCode
>;

function toMutationErrorDetails(
  error: ProviderMappingMutationError,
): Record<string, unknown> | undefined {
  switch (error.code) {
    case "DUPLICATE_CANONICAL_FIELD_MAPPINGS":
      return { duplicateCanonicalFields: error.duplicateCanonicalFields };
    case "REQUIRED_CANONICAL_FIELDS_MISSING":
      return { missingCanonicalFields: error.missingCanonicalFields };
    case "MERCHANT_SIGNAL_FIELD_REQUIRED":
      return undefined;
    case "INVALID_PROVIDER_MAPPING_DEFINITION":
      return {
        code: error.configurationErrorCode,
        ...(error.details ? { details: error.details } : {}),
      };
    default:
      return undefined;
  }
}

export async function createImportProviderMappingAction(
  input: unknown,
): Promise<CreateProviderMappingActionResult> {
  const parsedInput = createProviderMappingSchema.safeParse(input);

  if (!parsedInput.success) {
    return mutationValidationError(
      "INVALID_PROVIDER_MAPPING_PAYLOAD",
      "Expected providerName, fieldMappings, and optional mappingVersion.",
      parsedInput.error,
    );
  }

  const compileResult = compileProviderMapping({
    id: "",
    providerName: parsedInput.data.providerName,
    mappingVersion: parsedInput.data.mappingVersion ?? null,
    normalizationRules: parsedInput.data.normalizationRules,
    fieldMappings: parsedInput.data.fieldMappings.map((fieldMapping) => ({
      sourceField: fieldMapping.sourceField,
      canonicalField: fieldMapping.canonicalField,
      transformRules: fieldMapping.transformRules ?? null,
    })),
  });

  if (!compileResult.ok) {
    const mappingError = toProviderMappingMutationError(compileResult.error);
    return mutationError(
      mappingError.code,
      mappingError.message,
      toMutationErrorDetails(mappingError),
    );
  }

  return executeServerMutation({
    execute: async () => {
      const mapping = await prisma.importProviderMapping.create({
        data: {
          providerName: parsedInput.data.providerName,
          normalizationRules: parsedInput.data.normalizationRules,
          mappingVersion: parsedInput.data.mappingVersion,
          fieldMappings: {
            create: parsedInput.data.fieldMappings.map((fieldMapping) => ({
              sourceField: fieldMapping.sourceField,
              canonicalField: fieldMapping.canonicalField,
              transformRules: fieldMapping.transformRules,
            })),
          },
        },
        select: { id: true },
      });

      revalidatePath("/import-provider-mappings");

      return { mappingId: mapping.id };
    },
    mapError: (error) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return {
          code: "PROVIDER_MAPPING_MUST_BE_UNIQUE",
          message: "A provider mapping with this name already exists.",
        };
      }

      return null;
    },
    fallbackError: {
      code: "PROVIDER_MAPPING_CREATE_FAILED",
      message: "Could not create provider mapping.",
    },
  });
}

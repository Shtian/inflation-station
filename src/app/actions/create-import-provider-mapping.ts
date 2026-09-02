"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isInputJsonValue } from "@/lib/import/json-value";
import {
  compileProviderMappingDefinition,
  ProviderMappingCompilationError,
} from "@/lib/import/provider-adapter";
import {
  findMissingRequiredCanonicalFields,
  hasMerchantSignalCanonicalField,
} from "@/lib/import/provider-mapping-contract";
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
  | "PROVIDER_MAPPING_CONFIGURATION_INVALID"
  | "PROVIDER_MAPPING_MUST_BE_UNIQUE"
  | "PROVIDER_MAPPING_CREATE_FAILED";

type CreateProviderMappingActionResult = MutationActionResult<
  { mappingId: string },
  CreateProviderMappingActionErrorCode
>;

function findDuplicateCanonicalFields(
  fieldMappings: Array<{ canonicalField: string }>,
) {
  const counts = new Map<string, number>();

  for (const fieldMapping of fieldMappings) {
    counts.set(
      fieldMapping.canonicalField,
      (counts.get(fieldMapping.canonicalField) ?? 0) + 1,
    );
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([canonicalField]) => canonicalField)
    .sort();
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

  const duplicateCanonicalFields = findDuplicateCanonicalFields(
    parsedInput.data.fieldMappings,
  );
  if (duplicateCanonicalFields.length > 0) {
    return mutationError(
      "DUPLICATE_CANONICAL_FIELD_MAPPINGS",
      "Duplicate canonical field mappings.",
      { duplicateCanonicalFields },
    );
  }

  const missingCanonicalFields = findMissingRequiredCanonicalFields(
    parsedInput.data.fieldMappings.map(
      (fieldMapping) => fieldMapping.canonicalField,
    ),
  );
  if (missingCanonicalFields.length > 0) {
    return mutationError(
      "REQUIRED_CANONICAL_FIELDS_MISSING",
      "Missing required canonical fields.",
      { missingCanonicalFields },
    );
  }

  if (
    !hasMerchantSignalCanonicalField(
      parsedInput.data.fieldMappings.map(
        (fieldMapping) => fieldMapping.canonicalField,
      ),
    )
  ) {
    return mutationError(
      "MERCHANT_SIGNAL_FIELD_REQUIRED",
      "At least one merchant signal field mapping is required (name or title).",
    );
  }

  // Runtime detection/parsing and this mutation both compile a mapping
  // through the same validator, so a mapping cannot be saved as "configured"
  // while being unusable by the executable adapter contract (unsupported
  // mapping version, unknown normalization rule keys, malformed regex,
  // or unsupported field transforms).
  try {
    compileProviderMappingDefinition({
      id: "pending",
      providerName: parsedInput.data.providerName,
      mappingVersion: parsedInput.data.mappingVersion ?? 1,
      normalizationRules: parsedInput.data.normalizationRules,
      fieldMappings: parsedInput.data.fieldMappings,
    });
  } catch (error) {
    if (error instanceof ProviderMappingCompilationError) {
      return mutationError(
        "PROVIDER_MAPPING_CONFIGURATION_INVALID",
        error.message,
        { code: error.code, details: error.details },
      );
    }
    throw error;
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

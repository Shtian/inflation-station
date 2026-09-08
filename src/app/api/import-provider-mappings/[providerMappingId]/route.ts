import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isInputJsonValue } from "@/lib/import/json-value";
import { compileProviderMapping } from "@/lib/import/provider-adapter/compile-mapping";
import type { ProviderMappingRecord } from "@/lib/import/provider-adapter/mapping-definition";
import {
  type ProviderMappingMutationError,
  toProviderMappingMutationError,
} from "@/lib/import/provider-mapping-mutation-errors";
import { prisma } from "@/lib/prisma";

const jsonValueSchema = z.custom<Prisma.InputJsonValue>(
  (value) => isInputJsonValue(value),
  "Expected a JSON-serializable value.",
);

const fieldMappingSchema = z.object({
  sourceField: z.string().trim().min(1),
  canonicalField: z.string().trim().min(1),
  transformRules: jsonValueSchema.optional(),
});

const updateProviderMappingSchema = z
  .object({
    providerName: z.string().trim().min(1).optional(),
    fieldMappings: z.array(fieldMappingSchema).min(1).optional(),
    normalizationRules: jsonValueSchema.optional(),
    mappingVersion: z.number().int().positive().optional(),
  })
  .refine(
    (value) =>
      value.providerName !== undefined ||
      value.fieldMappings !== undefined ||
      value.normalizationRules !== undefined ||
      value.mappingVersion !== undefined,
    {
      message: "At least one field must be provided",
    },
  );

type RouteParams = {
  params: Promise<unknown>;
};

function toProviderMappingRoutePayload(
  error: ProviderMappingMutationError,
): Record<string, unknown> {
  switch (error.code) {
    case "DUPLICATE_CANONICAL_FIELD_MAPPINGS":
      return {
        error: error.code,
        duplicateCanonicalFields: error.duplicateCanonicalFields,
      };
    case "REQUIRED_CANONICAL_FIELDS_MISSING":
      return {
        error: error.code,
        missingCanonicalFields: error.missingCanonicalFields,
      };
    case "MERCHANT_SIGNAL_FIELD_REQUIRED":
      return { error: error.code, message: error.message };
    case "INVALID_PROVIDER_MAPPING_DEFINITION":
      return {
        error: error.code,
        code: error.configurationErrorCode,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      };
  }
}

async function parseProviderMappingId(params: Promise<unknown>) {
  const routeParams = await params;

  return typeof routeParams === "object" &&
    routeParams !== null &&
    "providerMappingId" in routeParams &&
    typeof routeParams.providerMappingId === "string"
    ? routeParams.providerMappingId
    : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const providerMappingId = await parseProviderMappingId(params);
  if (!providerMappingId) {
    return NextResponse.json(
      { error: "INVALID_PROVIDER_MAPPING_ID" },
      { status: 400 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateProviderMappingSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_PROVIDER_MAPPING_UPDATE_PAYLOAD",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const currentMapping = await prisma.importProviderMapping.findUnique({
    where: { id: providerMappingId },
    select: {
      id: true,
      providerName: true,
      mappingVersion: true,
      normalizationRules: true,
      fieldMappings: {
        select: {
          sourceField: true,
          canonicalField: true,
          transformRules: true,
        },
      },
    },
  });

  if (!currentMapping) {
    return NextResponse.json(
      { error: "PROVIDER_MAPPING_NOT_FOUND" },
      { status: 404 },
    );
  }

  const mergedRecord: ProviderMappingRecord = {
    id: currentMapping.id,
    providerName: parsed.data.providerName ?? currentMapping.providerName,
    mappingVersion: parsed.data.mappingVersion ?? currentMapping.mappingVersion,
    normalizationRules:
      parsed.data.normalizationRules ?? currentMapping.normalizationRules,
    fieldMappings: (
      parsed.data.fieldMappings ?? currentMapping.fieldMappings
    ).map((fieldMapping) => ({
      sourceField: fieldMapping.sourceField,
      canonicalField: fieldMapping.canonicalField,
      transformRules: fieldMapping.transformRules ?? null,
    })),
  };

  const compileResult = compileProviderMapping(mergedRecord);
  if (!compileResult.ok) {
    const mappingError = toProviderMappingMutationError(compileResult.error);
    return NextResponse.json(toProviderMappingRoutePayload(mappingError), {
      status: 400,
    });
  }

  try {
    const mapping = await prisma.importProviderMapping.update({
      where: { id: providerMappingId },
      data: {
        ...(parsed.data.providerName !== undefined
          ? { providerName: parsed.data.providerName }
          : {}),
        ...(parsed.data.normalizationRules !== undefined
          ? { normalizationRules: parsed.data.normalizationRules }
          : {}),
        ...(parsed.data.mappingVersion !== undefined
          ? { mappingVersion: parsed.data.mappingVersion }
          : {}),
        ...(parsed.data.fieldMappings
          ? {
              fieldMappings: {
                deleteMany: {},
                create: parsed.data.fieldMappings.map((fieldMapping) => ({
                  sourceField: fieldMapping.sourceField,
                  canonicalField: fieldMapping.canonicalField,
                  transformRules: fieldMapping.transformRules,
                })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        providerName: true,
        normalizationRules: true,
        mappingVersion: true,
        createdAt: true,
        updatedAt: true,
        fieldMappings: {
          select: {
            id: true,
            sourceField: true,
            canonicalField: true,
            transformRules: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ canonicalField: "asc" }, { id: "asc" }],
        },
      },
    });

    return NextResponse.json({ mapping });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "PROVIDER_MAPPING_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "PROVIDER_MAPPING_MUST_BE_UNIQUE" },
        { status: 409 },
      );
    }

    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const providerMappingId = await parseProviderMappingId(params);
  if (!providerMappingId) {
    return NextResponse.json(
      { error: "INVALID_PROVIDER_MAPPING_ID" },
      { status: 400 },
    );
  }

  try {
    await prisma.importProviderMapping.delete({
      where: { id: providerMappingId },
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "PROVIDER_MAPPING_NOT_FOUND" },
        { status: 404 },
      );
    }

    throw error;
  }
}

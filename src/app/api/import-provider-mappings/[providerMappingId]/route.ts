import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isInputJsonValue } from "../../../../lib/import/json-value";
import {
  findMissingRequiredCanonicalFields,
  hasMerchantSignalCanonicalField,
} from "../../../../lib/import/provider-mapping-contract";

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

function findDuplicateCanonicalFields(
  fieldMappings: { canonicalField: string }[],
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

  if (parsed.data.fieldMappings) {
    const duplicateCanonicalFields = findDuplicateCanonicalFields(
      parsed.data.fieldMappings,
    );

    if (duplicateCanonicalFields.length > 0) {
      return NextResponse.json(
        {
          error: "DUPLICATE_CANONICAL_FIELD_MAPPINGS",
          duplicateCanonicalFields,
        },
        { status: 400 },
      );
    }

    const missingCanonicalFields = findMissingRequiredCanonicalFields(
      parsed.data.fieldMappings.map(
        (fieldMapping) => fieldMapping.canonicalField,
      ),
    );
    if (missingCanonicalFields.length > 0) {
      return NextResponse.json(
        {
          error: "REQUIRED_CANONICAL_FIELDS_MISSING",
          missingCanonicalFields,
        },
        { status: 400 },
      );
    }

    if (
      !hasMerchantSignalCanonicalField(
        parsed.data.fieldMappings.map(
          (fieldMapping) => fieldMapping.canonicalField,
        ),
      )
    ) {
      return NextResponse.json(
        {
          error: "MERCHANT_SIGNAL_FIELD_REQUIRED",
          message:
            "At least one merchant signal field (name or title) is required.",
        },
        { status: 400 },
      );
    }
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

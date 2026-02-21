import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const mappings = await prisma.importProviderMapping.findMany({
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
    orderBy: [{ providerName: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ mappings });
}

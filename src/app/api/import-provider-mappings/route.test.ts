import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    importProviderMapping: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const requiredFieldMappings = [
  { sourceField: "Bokfort", canonicalField: "bookingDate" },
  { sourceField: "Belop", canonicalField: "amount" },
  { sourceField: "Avsender", canonicalField: "sender" },
  { sourceField: "Mottaker", canonicalField: "recipient" },
  { sourceField: "Navn", canonicalField: "name" },
  { sourceField: "Tittel", canonicalField: "title" },
  { sourceField: "Valuta", canonicalField: "currency" },
  { sourceField: "Type", canonicalField: "paymentType" },
];

describe("GET /api/import-provider-mappings", () => {
  beforeEach(() => {
    prismaMock.importProviderMapping.findMany.mockReset();
    prismaMock.importProviderMapping.findMany.mockResolvedValue([]);
  });

  it("returns provider mappings with nested field mappings", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(prismaMock.importProviderMapping.findMany).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ mappings: [] });
  });
});

describe("POST /api/import-provider-mappings", () => {
  beforeEach(() => {
    prismaMock.importProviderMapping.create.mockReset();
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/import-provider-mappings", {
        method: "POST",
        body: JSON.stringify({ providerName: "" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_PAYLOAD",
    });
    expect(prismaMock.importProviderMapping.create).not.toHaveBeenCalled();
  });

  it("returns 400 when required canonical fields are missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/import-provider-mappings", {
        method: "POST",
        body: JSON.stringify({
          providerName: "Bank A",
          normalizationRules: {},
          fieldMappings: requiredFieldMappings.slice(0, 3),
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "REQUIRED_CANONICAL_FIELDS_MISSING",
      missingCanonicalFields: [
        "recipient",
        "name",
        "title",
        "currency",
        "paymentType",
      ],
    });
    expect(prismaMock.importProviderMapping.create).not.toHaveBeenCalled();
  });

  it("creates provider mapping for valid payload", async () => {
    prismaMock.importProviderMapping.create.mockResolvedValue({
      id: "provider-1",
      providerName: "Bank A",
      normalizationRules: { trimMessage: true },
      mappingVersion: 1,
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:00:00.000Z",
      fieldMappings: [],
    });

    const response = await POST(
      new Request("http://localhost/api/import-provider-mappings", {
        method: "POST",
        body: JSON.stringify({
          providerName: "Bank A",
          normalizationRules: { trimMessage: true },
          mappingVersion: 1,
          fieldMappings: requiredFieldMappings,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(201);
    expect(prismaMock.importProviderMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerName: "Bank A",
          normalizationRules: { trimMessage: true },
          mappingVersion: 1,
          fieldMappings: {
            create: requiredFieldMappings.map((fieldMapping) => ({
              sourceField: fieldMapping.sourceField,
              canonicalField: fieldMapping.canonicalField,
              transformRules: undefined,
            })),
          },
        }),
      }),
    );
    await expect(response.json()).resolves.toEqual({
      mapping: {
        id: "provider-1",
        providerName: "Bank A",
        normalizationRules: { trimMessage: true },
        mappingVersion: 1,
        createdAt: "2026-02-17T00:00:00.000Z",
        updatedAt: "2026-02-17T00:00:00.000Z",
        fieldMappings: [],
      },
    });
  });
});

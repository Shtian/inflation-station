import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    importProviderMapping: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

function buildCurrentMapping(
  overrides: Partial<{
    id: string;
    providerName: string;
    mappingVersion: number;
    normalizationRules: unknown;
    fieldMappings: Array<{
      sourceField: string;
      canonicalField: string;
      transformRules: unknown;
    }>;
  }> = {},
) {
  return {
    id: "provider-1",
    providerName: "Bank A",
    mappingVersion: 1,
    normalizationRules: {},
    fieldMappings: requiredFieldMappings.map((fieldMapping) => ({
      ...fieldMapping,
      transformRules: null,
    })),
    ...overrides,
  };
}

function patchRequest(body: unknown): Request {
  return new Request("http://localhost", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function patchMapping(body: unknown, providerMappingId = "provider-1") {
  return PATCH(patchRequest(body), {
    params: Promise.resolve({ providerMappingId }),
  });
}

describe("PATCH /api/import-provider-mappings/[providerMappingId]", () => {
  beforeEach(() => {
    prismaMock.importProviderMapping.findUnique.mockReset();
    prismaMock.importProviderMapping.findUnique.mockResolvedValue(
      buildCurrentMapping(),
    );
    prismaMock.importProviderMapping.update.mockReset();
  });

  it("returns 400 when providerMappingId route param is invalid", async () => {
    const response = await PATCH(new Request("http://localhost"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_PROVIDER_MAPPING_ID",
    });
    expect(prismaMock.importProviderMapping.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("returns 400 when update payload is invalid", async () => {
    const response = await patchMapping({});

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_UPDATE_PAYLOAD",
    });
    expect(prismaMock.importProviderMapping.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("returns 400 when a field mapping source field is blank", async () => {
    const response = await patchMapping({
      fieldMappings: [
        { sourceField: "   ", canonicalField: "bookingDate" },
        ...requiredFieldMappings.slice(1),
      ],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_UPDATE_PAYLOAD",
    });
    expect(prismaMock.importProviderMapping.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the provider mapping does not exist", async () => {
    prismaMock.importProviderMapping.findUnique.mockResolvedValue(null);

    const response = await patchMapping(
      { providerName: "Renamed Bank" },
      "missing-provider",
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "PROVIDER_MAPPING_NOT_FOUND",
    });
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("returns 400 when merchant signal mapping is missing from the submitted field mappings", async () => {
    const response = await patchMapping({
      fieldMappings: requiredFieldMappings.slice(0, 2),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "MERCHANT_SIGNAL_FIELD_REQUIRED",
      message:
        "At least one merchant signal field mapping is required (name or title).",
    });
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("validates the full merged definition, rejecting when the current mapping already lacks a merchant signal", async () => {
    prismaMock.importProviderMapping.findUnique.mockResolvedValue(
      buildCurrentMapping({
        fieldMappings: [
          {
            sourceField: "Bokfort",
            canonicalField: "bookingDate",
            transformRules: null,
          },
          {
            sourceField: "Belop",
            canonicalField: "amount",
            transformRules: null,
          },
        ],
      }),
    );

    const response = await patchMapping({ providerName: "Renamed Bank" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "MERCHANT_SIGNAL_FIELD_REQUIRED",
      message:
        "At least one merchant signal field mapping is required (name or title).",
    });
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("rejects an unsupported mapping version", async () => {
    const response = await patchMapping({
      mappingVersion: 2,
      fieldMappings: requiredFieldMappings,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_DEFINITION",
      code: "UNSUPPORTED_MAPPING_VERSION",
    });
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("rejects an unknown normalization rule key", async () => {
    const response = await patchMapping({
      normalizationRules: { encoding: "utf-8" },
      fieldMappings: requiredFieldMappings,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_DEFINITION",
      code: "UNKNOWN_NORMALIZATION_RULE",
    });
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("rejects an unsupported delimiter", async () => {
    const response = await patchMapping({
      normalizationRules: { delimiter: "|" },
      fieldMappings: requiredFieldMappings,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_DEFINITION",
      code: "UNSUPPORTED_DELIMITER",
    });
  });

  it("rejects an unsupported decimal separator", async () => {
    const response = await patchMapping({
      normalizationRules: { decimalSeparator: "x" },
      fieldMappings: requiredFieldMappings,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_DEFINITION",
      code: "UNSUPPORTED_DECIMAL_SEPARATOR",
    });
  });

  it("rejects an unsupported date format", async () => {
    const response = await patchMapping({
      normalizationRules: { dateFormat: "MM/DD/YYYY" },
      fieldMappings: requiredFieldMappings,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_DEFINITION",
      code: "UNSUPPORTED_DATE_FORMAT",
    });
  });

  it("rejects a malformed header regular expression", async () => {
    const response = await patchMapping({
      normalizationRules: { headerPatterns: ["("] },
      fieldMappings: requiredFieldMappings,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_DEFINITION",
      code: "INVALID_HEADER_PATTERN",
    });
  });

  it("rejects an unknown canonical field", async () => {
    const response = await patchMapping({
      fieldMappings: [
        ...requiredFieldMappings,
        { sourceField: "Merchant", canonicalField: "normalizedMerchant" },
      ],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_DEFINITION",
      code: "UNKNOWN_CANONICAL_FIELD",
    });
  });

  it("rejects duplicate canonical field mappings", async () => {
    const response = await patchMapping({
      fieldMappings: [
        ...requiredFieldMappings,
        { sourceField: "Belop2", canonicalField: "amount" },
      ],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "DUPLICATE_CANONICAL_FIELD_MAPPINGS",
      duplicateCanonicalFields: ["amount"],
    });
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("rejects field mappings missing required canonical fields", async () => {
    const response = await patchMapping({
      fieldMappings: [{ sourceField: "Navn", canonicalField: "name" }],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "REQUIRED_CANONICAL_FIELDS_MISSING",
      missingCanonicalFields: ["bookingDate", "amount"],
    });
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("rejects an unsupported field transform type", async () => {
    const response = await patchMapping({
      fieldMappings: requiredFieldMappings.map((fieldMapping) =>
        fieldMapping.canonicalField === "amount"
          ? { ...fieldMapping, transformRules: [{ type: "unknownTransform" }] }
          : fieldMapping,
      ),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_DEFINITION",
      code: "UNSUPPORTED_FIELD_TRANSFORM",
    });
  });

  it("rejects a malformed field transform", async () => {
    const response = await patchMapping({
      fieldMappings: requiredFieldMappings.map((fieldMapping) =>
        fieldMapping.canonicalField === "amount"
          ? { ...fieldMapping, transformRules: [{ type: "mapValues" }] }
          : fieldMapping,
      ),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_DEFINITION",
      code: "INVALID_FIELD_TRANSFORM",
    });
  });

  it("accepts a partial update that only changes the provider name", async () => {
    prismaMock.importProviderMapping.update.mockResolvedValue({
      id: "provider-1",
      providerName: "Renamed Bank",
      normalizationRules: {},
      mappingVersion: 1,
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:10:00.000Z",
      fieldMappings: [],
    });

    const response = await patchMapping({ providerName: "Renamed Bank" });

    expect(response.status).toBe(200);
    expect(prismaMock.importProviderMapping.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "provider-1" },
        data: { providerName: "Renamed Bank" },
      }),
    );
  });

  it("updates a provider mapping", async () => {
    prismaMock.importProviderMapping.update.mockResolvedValue({
      id: "provider-1",
      providerName: "Bank A Updated",
      normalizationRules: { delimiter: ";" },
      mappingVersion: 1,
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:10:00.000Z",
      fieldMappings: [],
    });

    const response = await patchMapping({
      providerName: "Bank A Updated",
      normalizationRules: { delimiter: ";" },
      mappingVersion: 1,
      fieldMappings: requiredFieldMappings,
    });

    expect(response.status).toBe(200);
    expect(prismaMock.importProviderMapping.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "provider-1" },
        data: expect.objectContaining({
          providerName: "Bank A Updated",
          normalizationRules: { delimiter: ";" },
          mappingVersion: 1,
          fieldMappings: {
            deleteMany: {},
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
        providerName: "Bank A Updated",
        normalizationRules: { delimiter: ";" },
        mappingVersion: 1,
        createdAt: "2026-02-17T00:00:00.000Z",
        updatedAt: "2026-02-17T00:10:00.000Z",
        fieldMappings: [],
      },
    });
  });
});

describe("DELETE /api/import-provider-mappings/[providerMappingId]", () => {
  beforeEach(() => {
    prismaMock.importProviderMapping.delete.mockReset();
  });

  it("returns 404 when mapping does not exist", async () => {
    prismaMock.importProviderMapping.delete.mockRejectedValue({
      code: "P2025",
    });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ providerMappingId: "missing-provider" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "PROVIDER_MAPPING_NOT_FOUND",
    });
  });

  it("deletes provider mapping and returns 204", async () => {
    prismaMock.importProviderMapping.delete.mockResolvedValue(undefined);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ providerMappingId: "provider-1" }),
    });

    expect(response.status).toBe(204);
    expect(prismaMock.importProviderMapping.delete).toHaveBeenCalledWith({
      where: { id: "provider-1" },
    });
  });
});

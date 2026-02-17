import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    importProviderMapping: {
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

describe("PATCH /api/import-provider-mappings/[providerMappingId]", () => {
  beforeEach(() => {
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
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("returns 400 when update payload is invalid", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
      {
        params: Promise.resolve({ providerMappingId: "provider-1" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_PROVIDER_MAPPING_UPDATE_PAYLOAD",
    });
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("returns 400 when field mappings miss required canonical fields", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          fieldMappings: requiredFieldMappings.slice(0, 2),
        }),
        headers: { "Content-Type": "application/json" },
      }),
      {
        params: Promise.resolve({ providerMappingId: "provider-1" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "REQUIRED_CANONICAL_FIELDS_MISSING",
      missingCanonicalFields: [
        "sender",
        "recipient",
        "name",
        "title",
        "currency",
        "paymentType",
      ],
    });
    expect(prismaMock.importProviderMapping.update).not.toHaveBeenCalled();
  });

  it("updates a provider mapping", async () => {
    prismaMock.importProviderMapping.update.mockResolvedValue({
      id: "provider-1",
      providerName: "Bank A Updated",
      normalizationRules: { normalize: true },
      mappingVersion: 2,
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:10:00.000Z",
      fieldMappings: [],
    });

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          providerName: "Bank A Updated",
          normalizationRules: { normalize: true },
          mappingVersion: 2,
          fieldMappings: requiredFieldMappings,
        }),
        headers: { "Content-Type": "application/json" },
      }),
      {
        params: Promise.resolve({ providerMappingId: "provider-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.importProviderMapping.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "provider-1" },
        data: expect.objectContaining({
          providerName: "Bank A Updated",
          normalizationRules: { normalize: true },
          mappingVersion: 2,
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
        normalizationRules: { normalize: true },
        mappingVersion: 2,
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

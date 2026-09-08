import { beforeEach, describe, expect, it, vi } from "vitest";
import { createImportProviderMappingAction } from "./create-import-provider-mapping";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    importProviderMapping: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const requiredFieldMappings = [
  { sourceField: "Bokfort", canonicalField: "bookingDate" },
  { sourceField: "Belop", canonicalField: "amount" },
  { sourceField: "Navn", canonicalField: "name" },
];

describe("createImportProviderMappingAction", () => {
  beforeEach(() => {
    prismaMock.importProviderMapping.create.mockReset();
  });

  it("returns INVALID_PROVIDER_MAPPING_PAYLOAD when the input fails shape validation", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "",
      fieldMappings: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PROVIDER_MAPPING_PAYLOAD");
    expect(prismaMock.importProviderMapping.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate canonical field mappings", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      fieldMappings: [
        ...requiredFieldMappings,
        { sourceField: "Belop2", canonicalField: "amount" },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: "DUPLICATE_CANONICAL_FIELD_MAPPINGS",
      message: expect.any(String),
      details: { duplicateCanonicalFields: ["amount"] },
    });
    expect(prismaMock.importProviderMapping.create).not.toHaveBeenCalled();
  });

  it("rejects field mappings missing required canonical fields", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      fieldMappings: [{ sourceField: "Navn", canonicalField: "name" }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: "REQUIRED_CANONICAL_FIELDS_MISSING",
      message: expect.any(String),
      details: { missingCanonicalFields: ["bookingDate", "amount"] },
    });
    expect(prismaMock.importProviderMapping.create).not.toHaveBeenCalled();
  });

  it("rejects field mappings missing a merchant signal", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      fieldMappings: requiredFieldMappings.slice(0, 2),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MERCHANT_SIGNAL_FIELD_REQUIRED");
    expect(prismaMock.importProviderMapping.create).not.toHaveBeenCalled();
  });

  it("rejects an unsupported mapping version", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      mappingVersion: 2,
      fieldMappings: requiredFieldMappings,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PROVIDER_MAPPING_DEFINITION");
    expect(result.error.details).toMatchObject({
      code: "UNSUPPORTED_MAPPING_VERSION",
    });
    expect(prismaMock.importProviderMapping.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown normalization rule key", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      normalizationRules: { encoding: "utf-8" },
      fieldMappings: requiredFieldMappings,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PROVIDER_MAPPING_DEFINITION");
    expect(result.error.details).toMatchObject({
      code: "UNKNOWN_NORMALIZATION_RULE",
    });
  });

  it("rejects an unsupported delimiter", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      normalizationRules: { delimiter: "|" },
      fieldMappings: requiredFieldMappings,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toMatchObject({
      code: "UNSUPPORTED_DELIMITER",
    });
  });

  it("rejects an unsupported decimal separator", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      normalizationRules: { decimalSeparator: "x" },
      fieldMappings: requiredFieldMappings,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toMatchObject({
      code: "UNSUPPORTED_DECIMAL_SEPARATOR",
    });
  });

  it("rejects an unsupported date format", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      normalizationRules: { dateFormat: "MM/DD/YYYY" },
      fieldMappings: requiredFieldMappings,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toMatchObject({
      code: "UNSUPPORTED_DATE_FORMAT",
    });
  });

  it("rejects a malformed header regular expression", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      normalizationRules: { headerPatterns: ["("] },
      fieldMappings: requiredFieldMappings,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toMatchObject({
      code: "INVALID_HEADER_PATTERN",
    });
  });

  it("rejects an unknown canonical field", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      fieldMappings: [
        ...requiredFieldMappings,
        { sourceField: "Merchant", canonicalField: "normalizedMerchant" },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PROVIDER_MAPPING_DEFINITION");
    expect(result.error.details).toMatchObject({
      code: "UNKNOWN_CANONICAL_FIELD",
    });
  });

  it("rejects an unsupported field transform type", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      fieldMappings: requiredFieldMappings.map((fieldMapping) =>
        fieldMapping.canonicalField === "amount"
          ? { ...fieldMapping, transformRules: [{ type: "unknownTransform" }] }
          : fieldMapping,
      ),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toMatchObject({
      code: "UNSUPPORTED_FIELD_TRANSFORM",
    });
  });

  it("rejects a malformed field transform", async () => {
    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      fieldMappings: requiredFieldMappings.map((fieldMapping) =>
        fieldMapping.canonicalField === "amount"
          ? { ...fieldMapping, transformRules: [{ type: "mapValues" }] }
          : fieldMapping,
      ),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toMatchObject({
      code: "INVALID_FIELD_TRANSFORM",
    });
  });

  it("creates a provider mapping for an accepted executable definition", async () => {
    prismaMock.importProviderMapping.create.mockResolvedValue({
      id: "provider-1",
    });

    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      normalizationRules: { delimiter: ";", decimalSeparator: "," },
      fieldMappings: requiredFieldMappings,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ mappingId: "provider-1" });
    expect(prismaMock.importProviderMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ providerName: "Bank A" }),
      }),
    );
  });

  it("returns PROVIDER_MAPPING_MUST_BE_UNIQUE when the provider name already exists", async () => {
    prismaMock.importProviderMapping.create.mockRejectedValue({
      code: "P2002",
    });

    const result = await createImportProviderMappingAction({
      providerName: "Bank A",
      fieldMappings: requiredFieldMappings,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PROVIDER_MAPPING_MUST_BE_UNIQUE");
  });
});

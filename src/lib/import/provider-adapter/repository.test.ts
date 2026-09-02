import { describe, expect, it, vi } from "vitest";
import type { ProviderMappingRecord } from "./mapping-definition";
import { loadProviderAdapters } from "./repository";

function dbWith(mappings: ProviderMappingRecord[]) {
  return {
    importProviderMapping: {
      findMany: vi.fn(async () => mappings),
    },
  };
}

describe("loadProviderAdapters", () => {
  it("compiles every valid persisted mapping into an adapter", async () => {
    const db = dbWith([
      {
        id: "provider-1",
        providerName: "Bank A",
        mappingVersion: 1,
        normalizationRules: {},
        fieldMappings: [
          { sourceField: "Dato", canonicalField: "bookingDate" },
          { sourceField: "Beløp", canonicalField: "amount" },
          { sourceField: "Tittel", canonicalField: "title" },
        ],
      },
    ]);

    const { adapters, compilationFailures } = await loadProviderAdapters(db);

    expect(adapters).toHaveLength(1);
    expect(adapters[0].id).toBe("provider-1");
    expect(compilationFailures).toEqual([]);
  });

  it("surfaces a stable diagnostic for an invalid persisted mapping instead of throwing", async () => {
    const db = dbWith([
      {
        id: "provider-1",
        providerName: "Bank A",
        mappingVersion: 1,
        normalizationRules: { encoding: "UTF-8" },
        fieldMappings: [
          { sourceField: "Dato", canonicalField: "bookingDate" },
          { sourceField: "Beløp", canonicalField: "amount" },
          { sourceField: "Tittel", canonicalField: "title" },
        ],
      },
      {
        id: "provider-2",
        providerName: "Bank B",
        mappingVersion: 1,
        normalizationRules: {},
        fieldMappings: [
          { sourceField: "Dato", canonicalField: "bookingDate" },
          { sourceField: "Beløp", canonicalField: "amount" },
          { sourceField: "Tittel", canonicalField: "title" },
        ],
      },
    ]);

    const { adapters, compilationFailures } = await loadProviderAdapters(db);

    expect(adapters).toHaveLength(1);
    expect(adapters[0].id).toBe("provider-2");
    expect(compilationFailures).toEqual([
      {
        providerId: "provider-1",
        providerName: "Bank A",
        code: "INVALID_NORMALIZATION_RULES",
        message: expect.any(String),
      },
    ]);
  });
});

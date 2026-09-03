import { describe, expect, it, vi } from "vitest";
import type { ProviderMappingRecord } from "./mapping-definition";
import {
  loadProviderAdapters,
  type ProviderAdapterDbClient,
} from "./repository";

const executableFieldMappings: ProviderMappingRecord["fieldMappings"] = [
  {
    sourceField: "Bokføringsdato",
    canonicalField: "bookingDate",
    transformRules: null,
  },
  { sourceField: "Beløp", canonicalField: "amount", transformRules: null },
  {
    sourceField: "Beskrivelse",
    canonicalField: "name",
    transformRules: null,
  },
];

function createDbMock(
  mappings: ProviderMappingRecord[],
): ProviderAdapterDbClient {
  return {
    importProviderMapping: {
      findMany: vi.fn(async () => mappings),
    },
  };
}

describe("loadProviderAdapters", () => {
  it("compiles every persisted mapping into an adapter through one query", async () => {
    const db = createDbMock([
      {
        id: "bank-a",
        providerName: "Bank A",
        mappingVersion: 1,
        normalizationRules: {
          requiredHeaders: ["Bokføringsdato", "Beløp"],
        },
        fieldMappings: executableFieldMappings,
      },
      {
        id: "bank-b",
        providerName: "Bank B",
        mappingVersion: 1,
        normalizationRules: {
          requiredHeaders: ["Dato", "Belastning"],
        },
        fieldMappings: [
          {
            sourceField: "Dato",
            canonicalField: "bookingDate",
            transformRules: null,
          },
          {
            sourceField: "Belastning",
            canonicalField: "amount",
            transformRules: null,
          },
          {
            sourceField: "Konto",
            canonicalField: "name",
            transformRules: null,
          },
        ],
      },
    ]);

    const result = await loadProviderAdapters(db);

    expect(result.configurationErrors).toEqual([]);
    expect(result.adapters.map((adapter) => adapter.providerId)).toEqual([
      "bank-a",
      "bank-b",
    ]);
    expect(db.importProviderMapping.findMany).toHaveBeenCalledTimes(1);
  });

  it("collects a configuration error for a mapping that fails compilation instead of throwing", async () => {
    const db = createDbMock([
      {
        id: "broken-bank",
        providerName: "Broken Bank",
        mappingVersion: 1,
        normalizationRules: { encoding: "utf-8" },
        fieldMappings: executableFieldMappings,
      },
      {
        id: "bank-b",
        providerName: "Bank B",
        mappingVersion: 1,
        normalizationRules: {
          requiredHeaders: ["Bokføringsdato", "Beløp"],
        },
        fieldMappings: executableFieldMappings,
      },
    ]);

    const result = await loadProviderAdapters(db);

    expect(result.adapters.map((adapter) => adapter.providerId)).toEqual([
      "bank-b",
    ]);
    expect(result.configurationErrors).toHaveLength(1);
    expect(result.configurationErrors[0]).toMatchObject({
      code: "UNKNOWN_NORMALIZATION_RULE",
      providerName: "Broken Bank",
      details: { providerMappingId: "broken-bank" },
    });
  });

  it("keeps distinguishable diagnostics for multiple invalid mappings via providerMappingId", async () => {
    const db = createDbMock([
      {
        id: "broken-bank-1",
        providerName: "Broken Bank",
        mappingVersion: 1,
        normalizationRules: { encoding: "utf-8" },
        fieldMappings: executableFieldMappings,
      },
      {
        id: "broken-bank-2",
        providerName: "Broken Bank",
        mappingVersion: 2,
        normalizationRules: {},
        fieldMappings: executableFieldMappings,
      },
    ]);

    const result = await loadProviderAdapters(db);

    expect(result.adapters).toEqual([]);
    expect(
      result.configurationErrors.map(
        (error) => error.details?.providerMappingId,
      ),
    ).toEqual(["broken-bank-1", "broken-bank-2"]);
    expect(result.configurationErrors[1]?.code).toBe(
      "UNSUPPORTED_MAPPING_VERSION",
    );
  });

  it("returns no adapters and no errors when there are no persisted mappings", async () => {
    const db = createDbMock([]);

    const result = await loadProviderAdapters(db);

    expect(result.adapters).toEqual([]);
    expect(result.configurationErrors).toEqual([]);
    expect(db.importProviderMapping.findMany).toHaveBeenCalledTimes(1);
  });
});

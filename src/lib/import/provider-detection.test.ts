import { describe, expect, it, vi } from "vitest";
import { detectProviderFromCsv } from "./provider-detection";

type MockFieldMapping = {
  sourceField: string;
  canonicalField: string;
  transformRules: unknown;
};

type MockMapping = {
  id: string;
  providerName: string;
  mappingVersion: number | null;
  normalizationRules: unknown;
  fieldMappings: MockFieldMapping[];
};

function createDbMock(mappings: MockMapping[]) {
  return {
    importProviderMapping: {
      findMany: vi.fn(async () => mappings),
    },
  };
}

// Minimal executable field mappings (bookingDate + amount + a merchant
// signal) so compileProviderMapping succeeds; detection itself is driven by
// each mapping's explicit `requiredHeaders`/`anyHeaders`/`headerPatterns`.
const executableFieldMappings: MockFieldMapping[] = [
  {
    sourceField: "Bokføringsdato",
    canonicalField: "bookingDate",
    transformRules: null,
  },
  { sourceField: "Beløp", canonicalField: "amount", transformRules: null },
  { sourceField: "Beskrivelse", canonicalField: "name", transformRules: null },
];

describe("detectProviderFromCsv", () => {
  it("marks detection as certain when a provider fully matches required headers", async () => {
    const db = createDbMock([
      {
        id: "provider-1",
        providerName: "Bank A",
        mappingVersion: 1,
        normalizationRules: {
          requiredHeaders: ["Bokføringsdato", "Beløp", "Betalingstype"],
          headerPatterns: ["Bokføringsdato;Beløp"],
        },
        fieldMappings: executableFieldMappings,
      },
      {
        id: "provider-2",
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

    const result = await detectProviderFromCsv(
      db,
      "Bokføringsdato;Beløp;Betalingstype\n01.01.2026;100,00;Kort",
    );

    expect(result.state).toBe("certain");
    expect(result.providerId).toBe("provider-1");
    expect(result.providerName).toBe("Bank A");
    expect(result.score).toBeGreaterThan(1);
    expect(result.matchedHeaders).toEqual([
      "bokforingsdato",
      "belop",
      "betalingstype",
    ]);
  });

  it("marks detection as uncertain when there is a partial provider match", async () => {
    const db = createDbMock([
      {
        id: "provider-2",
        providerName: "Bank B",
        mappingVersion: 1,
        normalizationRules: {
          requiredHeaders: ["Dato", "Beløp", "Referanse", "Konto"],
        },
        fieldMappings: [
          {
            sourceField: "Dato",
            canonicalField: "bookingDate",
            transformRules: null,
          },
          {
            sourceField: "Beløp",
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

    const result = await detectProviderFromCsv(
      db,
      "Dato;Beløp;Referanse\n2026-01-01;100,00;abc",
    );

    expect(result.state).toBe("uncertain");
    expect(result.providerId).toBe("provider-2");
    expect(result.providerName).toBe("Bank B");
    expect(result.score).toBeGreaterThan(0);
  });

  it("marks detection as missing when there is no usable provider match", async () => {
    const db = createDbMock([
      {
        id: "provider-1",
        providerName: "Bank A",
        mappingVersion: 1,
        normalizationRules: {
          requiredHeaders: ["Bokføringsdato", "Beløp"],
        },
        fieldMappings: executableFieldMappings,
      },
    ]);

    const result = await detectProviderFromCsv(db, "01.01.2026;100,00");

    expect(result.state).toBe("missing");
    expect(result.providerId).toBeNull();
    expect(result.providerName).toBeNull();
    expect(result.score).toBe(0);
  });

  it("falls back to source-field mappings when no requiredHeaders rule is configured", async () => {
    const db = createDbMock([
      {
        id: "provider-1",
        providerName: "Bank A",
        mappingVersion: 1,
        normalizationRules: {},
        fieldMappings: [
          {
            sourceField: "Bokføringsdato",
            canonicalField: "bookingDate",
            transformRules: null,
          },
          {
            sourceField: "Beløp",
            canonicalField: "amount",
            transformRules: null,
          },
          {
            sourceField: "Betalingstype",
            canonicalField: "name",
            transformRules: null,
          },
        ],
      },
    ]);

    const result = await detectProviderFromCsv(
      db,
      "Bokføringsdato;Beløp;Betalingstype\n01.01.2026;100,00;Kort",
    );

    expect(result.state).toBe("certain");
    expect(result.providerId).toBe("provider-1");
    expect(result.candidates[0]).toMatchObject({
      providerId: "provider-1",
      requiredMatches: 3,
      requiredTotal: 3,
    });
  });

  it("skips a mapping record that fails compilation rather than crashing detection", async () => {
    const db = createDbMock([
      {
        id: "provider-1",
        providerName: "Broken Bank",
        mappingVersion: 1,
        normalizationRules: { encoding: "utf-8" },
        fieldMappings: executableFieldMappings,
      },
      {
        id: "provider-2",
        providerName: "Bank B",
        mappingVersion: 1,
        normalizationRules: {
          requiredHeaders: ["Bokføringsdato", "Beløp"],
        },
        fieldMappings: executableFieldMappings,
      },
    ]);

    const result = await detectProviderFromCsv(
      db,
      "Bokføringsdato;Beløp;Betalingstype\n01.01.2026;100,00;Kort",
    );

    expect(result.state).toBe("certain");
    expect(result.providerId).toBe("provider-2");
    expect(result.candidates).toHaveLength(1);
  });
});

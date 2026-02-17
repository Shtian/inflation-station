import { describe, expect, it, vi } from "vitest";
import { detectProviderFromCsv } from "./provider-detection";

function createDbMock(
  mappings: Array<{
    id: string;
    providerName: string;
    normalizationRules: unknown;
    fieldMappings: Array<{ sourceField: string }>;
  }>,
) {
  return {
    importProviderMapping: {
      findMany: vi.fn(async () => mappings),
    },
  };
}

describe("detectProviderFromCsv", () => {
  it("marks detection as certain when a provider fully matches required headers", async () => {
    const db = createDbMock([
      {
        id: "provider-1",
        providerName: "Bank A",
        normalizationRules: {
          requiredHeaders: ["Bokføringsdato", "Beløp", "Betalingstype"],
          headerPatterns: ["Bokføringsdato;Beløp"],
        },
        fieldMappings: [],
      },
      {
        id: "provider-2",
        providerName: "Bank B",
        normalizationRules: {
          requiredHeaders: ["Dato", "Belastning"],
        },
        fieldMappings: [],
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
        normalizationRules: {
          requiredHeaders: ["Dato", "Beløp", "Referanse", "Konto"],
        },
        fieldMappings: [],
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
        normalizationRules: {
          requiredHeaders: ["Bokføringsdato", "Beløp"],
        },
        fieldMappings: [],
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
        normalizationRules: {},
        fieldMappings: [
          { sourceField: "Bokføringsdato" },
          { sourceField: "Beløp" },
          { sourceField: "Betalingstype" },
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
});

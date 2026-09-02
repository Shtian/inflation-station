import { describe, expect, it } from "vitest";
import { compileProviderAdapter } from "./adapter";
import { detectProvider } from "./detect";
import { compileProviderMappingDefinition } from "./mapping-definition";

function adapterFor(
  id: string,
  providerName: string,
  normalizationRules: Record<string, unknown>,
  fieldMappings: Array<{ sourceField: string; canonicalField: string }> = [
    { sourceField: "Dato", canonicalField: "bookingDate" },
    { sourceField: "Beløp", canonicalField: "amount" },
    { sourceField: "Tittel", canonicalField: "title" },
  ],
) {
  return compileProviderAdapter(
    compileProviderMappingDefinition({
      id,
      providerName,
      mappingVersion: 1,
      normalizationRules,
      fieldMappings,
    }),
  );
}

describe("detectProvider", () => {
  it("marks detection as certain when a provider fully matches required headers", () => {
    const providerA = adapterFor("provider-1", "Bank A", {
      requiredHeaders: ["Bokføringsdato", "Beløp", "Betalingstype"],
      headerPatterns: ["Bokføringsdato;Beløp"],
    });
    const providerB = adapterFor("provider-2", "Bank B", {
      requiredHeaders: ["Dato", "Belastning"],
    });

    const result = detectProvider(
      "Bokføringsdato;Beløp;Betalingstype\n01.01.2026;100,00;Kort",
      [providerA, providerB],
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

  it("marks detection as uncertain when there is a partial provider match", () => {
    const providerB = adapterFor("provider-2", "Bank B", {
      requiredHeaders: ["Dato", "Beløp", "Referanse", "Konto"],
    });

    const result = detectProvider(
      "Dato;Beløp;Referanse\n2026-01-01;100,00;abc",
      [providerB],
    );

    expect(result.state).toBe("uncertain");
    expect(result.providerId).toBe("provider-2");
    expect(result.providerName).toBe("Bank B");
    expect(result.score).toBeGreaterThan(0);
  });

  it("marks detection as missing when there is no usable provider match", () => {
    const providerA = adapterFor("provider-1", "Bank A", {
      requiredHeaders: ["Bokføringsdato", "Beløp"],
    });

    const result = detectProvider("01.01.2026;100,00", [providerA]);

    expect(result.state).toBe("missing");
    expect(result.providerId).toBeNull();
    expect(result.providerName).toBeNull();
    expect(result.score).toBe(0);
  });

  it("marks detection as missing when there are no compiled adapters", () => {
    const result = detectProvider("Dato;Beløp\n2026-01-01;100,00", []);

    expect(result).toEqual({
      state: "missing",
      providerId: null,
      providerName: null,
      score: 0,
      matchedHeaders: [],
      candidates: [],
    });
  });

  it("falls back to source-field mappings when no requiredHeaders rule is configured", () => {
    const providerA = adapterFor("provider-1", "Bank A", {}, [
      { sourceField: "Bokføringsdato", canonicalField: "bookingDate" },
      { sourceField: "Beløp", canonicalField: "amount" },
      { sourceField: "Betalingstype", canonicalField: "paymentType" },
      { sourceField: "Tittel", canonicalField: "title" },
    ]);

    const result = detectProvider(
      "Bokføringsdato;Beløp;Betalingstype;Tittel\n01.01.2026;100,00;Kort;Rent",
      [providerA],
    );

    expect(result.state).toBe("certain");
    expect(result.providerId).toBe("provider-1");
    expect(result.candidates[0]).toMatchObject({
      providerId: "provider-1",
      requiredMatches: 4,
      requiredTotal: 4,
    });
  });
});

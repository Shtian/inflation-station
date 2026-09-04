import { describe, expect, it } from "vitest";
import { createProviderAdapter } from "./adapter";
import { compileProviderMapping } from "./compile-mapping";
import { createCsvStatement } from "./csv-statement";
import { detectProviderFromAdapters } from "./detection";
import { NORDIC_SEMICOLON_CSV } from "./fixtures";
import type { ProviderMappingRecord } from "./mapping-definition";

function compileAdapter(record: ProviderMappingRecord) {
  const compiled = compileProviderMapping(record);
  if (!compiled.ok) {
    throw new Error(`Expected mapping to compile: ${compiled.error.message}`);
  }
  return createProviderAdapter(compiled.definition);
}

const bankAFields: ProviderMappingRecord["fieldMappings"] = [
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
  {
    sourceField: "Betalingstype",
    canonicalField: "paymentType",
    transformRules: null,
  },
];

const bankBFields: ProviderMappingRecord["fieldMappings"] = [
  { sourceField: "Dato", canonicalField: "bookingDate", transformRules: null },
  {
    sourceField: "Belastning",
    canonicalField: "amount",
    transformRules: null,
  },
  { sourceField: "Konto", canonicalField: "name", transformRules: null },
];

describe("detectProviderFromAdapters", () => {
  it("marks detection as certain when a provider fully matches required headers, ahead of the runner-up", () => {
    const bankA = compileAdapter({
      id: "bank-a",
      providerName: "Bank A",
      mappingVersion: 1,
      normalizationRules: {
        requiredHeaders: ["Bokføringsdato", "Beløp", "Betalingstype"],
        headerPatterns: ["Bokføringsdato;Beløp"],
      },
      fieldMappings: bankAFields,
    });
    const bankB = compileAdapter({
      id: "bank-b",
      providerName: "Bank B",
      mappingVersion: 1,
      normalizationRules: { requiredHeaders: ["Dato", "Belastning"] },
      fieldMappings: bankBFields,
    });

    const statement = createCsvStatement(NORDIC_SEMICOLON_CSV);
    const result = detectProviderFromAdapters([bankA, bankB], statement);

    expect(result.state).toBe("certain");
    expect(result.providerId).toBe("bank-a");
    expect(result.providerName).toBe("Bank A");
    expect(result.score).toBeGreaterThan(1);
    expect(result.matchedHeaders).toEqual([
      "bokforingsdato",
      "belop",
      "betalingstype",
    ]);
    expect(result.candidates.map((candidate) => candidate.providerId)).toEqual([
      "bank-a",
      "bank-b",
    ]);
  });

  it("marks detection as uncertain when the best candidate has only a partial required-header match", () => {
    const bankB = compileAdapter({
      id: "bank-b",
      providerName: "Bank B",
      mappingVersion: 1,
      normalizationRules: {
        requiredHeaders: ["Dato", "Beløp", "Referanse", "Konto"],
      },
      fieldMappings: bankBFields,
    });

    const statement = createCsvStatement(
      "Dato;Beløp;Referanse\n2026-01-01;100,00;abc",
    );
    const result = detectProviderFromAdapters([bankB], statement);

    expect(result.state).toBe("uncertain");
    expect(result.providerId).toBe("bank-b");
    expect(result.score).toBeGreaterThan(0);
  });

  it("marks detection as uncertain, with ordered candidates, when two fully-matching providers tie within the confidence separation, requiring explicit selection", () => {
    const bankX = compileAdapter({
      id: "bank-x",
      providerName: "Bank X",
      mappingVersion: 1,
      normalizationRules: { requiredHeaders: ["Dato", "Beløp"] },
      fieldMappings: bankBFields,
    });
    const bankY = compileAdapter({
      id: "bank-y",
      providerName: "Bank Y",
      mappingVersion: 1,
      normalizationRules: { requiredHeaders: ["Dato", "Beløp", "Referanse"] },
      fieldMappings: bankBFields,
    });

    const statement = createCsvStatement(
      "Dato;Beløp;Referanse\n2026-01-01;100,00;abc",
    );
    const result = detectProviderFromAdapters([bankX, bankY], statement);

    expect(result.state).toBe("uncertain");
    expect(result.candidates.length).toBe(2);
    expect(result.candidates[0].score).toBeGreaterThanOrEqual(
      result.candidates[1].score,
    );
    expect(result.candidates.map((candidate) => candidate.providerId)).toEqual([
      "bank-x",
      "bank-y",
    ]);
  });

  it("marks detection as missing when there is no header line", () => {
    const bankA = compileAdapter({
      id: "bank-a",
      providerName: "Bank A",
      mappingVersion: 1,
      normalizationRules: { requiredHeaders: ["Bokføringsdato", "Beløp"] },
      fieldMappings: bankAFields,
    });

    const statement = createCsvStatement("01.01.2026;100,00");
    const result = detectProviderFromAdapters([bankA], statement);

    expect(result.state).toBe("missing");
    expect(result.providerId).toBeNull();
    expect(result.providerName).toBeNull();
    expect(result.score).toBe(0);
    expect(result.candidates).toEqual([]);
  });

  it("marks detection as missing when there are no adapters", () => {
    const statement = createCsvStatement(NORDIC_SEMICOLON_CSV);
    const result = detectProviderFromAdapters([], statement);

    expect(result.state).toBe("missing");
    expect(result.candidates).toEqual([]);
  });

  it("marks detection as missing when the best score is 0", () => {
    const bankA = compileAdapter({
      id: "bank-a",
      providerName: "Bank A",
      mappingVersion: 1,
      normalizationRules: { requiredHeaders: ["Ukjent Felt"] },
      fieldMappings: bankAFields,
    });

    const statement = createCsvStatement(NORDIC_SEMICOLON_CSV);
    const result = detectProviderFromAdapters([bankA], statement);

    expect(result.state).toBe("missing");
    expect(result.score).toBe(0);
  });

  it("falls back to mapped source headers when no requiredHeaders rule is configured", () => {
    const bankA = compileAdapter({
      id: "bank-a",
      providerName: "Bank A",
      mappingVersion: 1,
      normalizationRules: {},
      fieldMappings: bankAFields,
    });

    const statement = createCsvStatement(NORDIC_SEMICOLON_CSV);
    const result = detectProviderFromAdapters([bankA], statement);

    expect(result.state).toBe("certain");
    expect(result.providerId).toBe("bank-a");
    expect(result.candidates[0]).toMatchObject({
      providerId: "bank-a",
      requiredMatches: 4,
      requiredTotal: 4,
    });
  });

  it("a provider detected as certain can then be parsed by the same winning adapter without a contradictory missing-header diagnostic", () => {
    const bankA = compileAdapter({
      id: "bank-a",
      providerName: "Bank A",
      mappingVersion: 1,
      normalizationRules: {},
      fieldMappings: bankAFields,
    });
    const bankB = compileAdapter({
      id: "bank-b",
      providerName: "Bank B",
      mappingVersion: 1,
      normalizationRules: { requiredHeaders: ["Dato", "Belastning"] },
      fieldMappings: bankBFields,
    });

    const statement = createCsvStatement(NORDIC_SEMICOLON_CSV);
    const adapters = [bankA, bankB];
    const result = detectProviderFromAdapters(adapters, statement);

    expect(result.state).toBe("certain");

    const winner = adapters.find(
      (adapter) => adapter.providerId === result.providerId,
    );
    expect(winner).toBeDefined();

    const parsed = winner?.parse(statement);
    expect(
      parsed?.errors.some((error) => error.code === "MISSING_REQUIRED_HEADERS"),
    ).toBe(false);
    expect(parsed?.rows.length).toBeGreaterThan(0);
  });
});

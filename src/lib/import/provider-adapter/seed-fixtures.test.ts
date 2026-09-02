import { describe, expect, it } from "vitest";
import { compileProviderAdapter } from "./adapter";
import { compileProviderMappingDefinition } from "./mapping-definition";

/**
 * Mirrors the provider mappings seeded in prisma/seed.mjs. Keeping this list
 * in sync with the seed script is a manual step (the seed script runs as
 * plain Node and cannot import this TypeScript module directly), but this
 * suite is what proves the seeded mappings compile under the executable
 * mapping contract and can parse a representative statement — the exact
 * failure mode issue #40 calls out ("seeded provider definitions use rule
 * and canonical-field names that do not fully match the currently
 * executable contract").
 */
const SEEDED_MAPPINGS = [
  {
    providerName: "DNB Bank",
    normalizationRules: {
      dateFormat: "DD.MM.YYYY" as const,
      decimalSeparator: "," as const,
      delimiter: ";" as const,
    },
    fieldMappings: [
      { sourceField: "Dato", canonicalField: "bookingDate" },
      { sourceField: "Forklaring", canonicalField: "title" },
      { sourceField: "Beløp", canonicalField: "amount" },
    ],
    fixtureCsv: "Dato;Forklaring;Beløp\n01.01.2026;Kiwi Minipris;250,00",
  },
  {
    providerName: "Nordea",
    normalizationRules: {
      dateFormat: "DD.MM.YYYY" as const,
      decimalSeparator: "," as const,
      delimiter: ";" as const,
    },
    fieldMappings: [
      { sourceField: "Bokføringsdato", canonicalField: "bookingDate" },
      { sourceField: "Beløp", canonicalField: "amount" },
      { sourceField: "Avsender", canonicalField: "sender" },
      { sourceField: "Mottaker", canonicalField: "recipient" },
      { sourceField: "Navn", canonicalField: "name" },
      { sourceField: "Tittel", canonicalField: "title" },
    ],
    fixtureCsv:
      "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel\n01.01.2026;100,00;Alice;Kiwi;Alice Hansen;Dagligvarer",
  },
  {
    providerName: "SpareBank 1",
    normalizationRules: {
      dateFormat: "DD.MM.YYYY" as const,
      decimalSeparator: "," as const,
      delimiter: ";" as const,
    },
    fieldMappings: [
      { sourceField: "Dato", canonicalField: "bookingDate" },
      { sourceField: "Beskrivelse", canonicalField: "title" },
      { sourceField: "Beløp", canonicalField: "amount" },
      { sourceField: "Avsender", canonicalField: "sender" },
      { sourceField: "Mottaker", canonicalField: "recipient" },
    ],
    fixtureCsv:
      "Dato;Beskrivelse;Beløp;Avsender;Mottaker\n01.01.2026;Rema 1000;150,00;Alice;Rema",
  },
];

describe("seeded provider mappings", () => {
  for (const seed of SEEDED_MAPPINGS) {
    it(`compiles and parses a representative statement for ${seed.providerName}`, () => {
      const definition = compileProviderMappingDefinition({
        id: `seed-${seed.providerName}`,
        providerName: seed.providerName,
        mappingVersion: 1,
        normalizationRules: seed.normalizationRules,
        fieldMappings: seed.fieldMappings,
      });
      const adapter = compileProviderAdapter(definition);

      const parsed = adapter.parse(seed.fixtureCsv);

      expect(parsed.errors).toEqual([]);
      expect(parsed.rows.length).toBeGreaterThan(0);
    });
  }
});

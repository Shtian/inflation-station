import { describe, expect, it } from "vitest";
import { createProviderAdapter } from "./adapter";
import { compileProviderMapping } from "./compile-mapping";
import { createCsvStatement } from "./csv-statement";
import type { ProviderMappingRecord } from "./mapping-definition";
import { SEEDED_PROVIDER_MAPPINGS } from "./seed-provider-mappings";

function compileSeedDefinition(providerName: string) {
  const definition = SEEDED_PROVIDER_MAPPINGS.find(
    (candidate) => candidate.providerName === providerName,
  );
  if (!definition) {
    throw new Error(`No seeded provider definition named "${providerName}"`);
  }

  const record: ProviderMappingRecord = {
    id: `seed:${providerName}`,
    ...definition,
  };

  const compiled = compileProviderMapping(record);
  if (!compiled.ok) {
    throw new Error(
      `Expected seeded "${providerName}" mapping to compile: ${compiled.error.message}`,
    );
  }

  return compiled.definition;
}

describe("SEEDED_PROVIDER_MAPPINGS", () => {
  it("compiles every retained seeded provider definition successfully", () => {
    for (const definition of SEEDED_PROVIDER_MAPPINGS) {
      const record: ProviderMappingRecord = {
        id: `seed:${definition.providerName}`,
        ...definition,
      };
      const compiled = compileProviderMapping(record);
      expect(
        compiled.ok,
        `${definition.providerName} failed to compile: ${
          compiled.ok ? "" : compiled.error.message
        }`,
      ).toBe(true);
    }
  });

  it("excludes DNB Bank until a supported debit/credit composition transform exists", () => {
    const providerNames = SEEDED_PROVIDER_MAPPINGS.map(
      (definition) => definition.providerName,
    );
    expect(providerNames).not.toContain("DNB Bank");
  });

  it("parses Nordea's representative statement into expected canonical rows and diagnostics", () => {
    const adapter = createProviderAdapter(compileSeedDefinition("Nordea"));
    const statement = createCsvStatement(
      [
        "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel",
        "15.01.2026;1234,56;Alice Hansen;ACME AS;Ola Nordmann;Dagligvarer kjøp",
        "reservert;100,00;Alice Hansen;ACME AS;Ola Nordmann;Reservert kjøp",
        "16.01.2026;ugyldig;Alice Hansen;ACME AS;Ola Nordmann;Ugyldig beløp",
      ].join("\n"),
    );

    const detection = adapter.detect(statement);
    expect(detection.requiredMatches).toBe(detection.requiredTotal);

    const parsed = adapter.parse(statement);
    expect(parsed.rows).toEqual([
      {
        bookingDate: "2026-01-15",
        amountNok: 1234.56,
        currency: "NOK",
        sender: "Alice Hansen",
        recipient: "ACME AS",
        name: "Ola Nordmann",
        title: "Dagligvarer kjøp",
        paymentType: "",
      },
    ]);
    expect(parsed.errors).toEqual([
      {
        rowNumber: 4,
        code: "INVALID_AMOUNT",
        message:
          'Row 4 has invalid amount "ugyldig". Expected decimal format using "," as the decimal separator.',
      },
    ]);
    expect(parsed.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 1,
      invalid: 1,
    });
  });

  it("parses SpareBank 1's representative statement into expected canonical rows and diagnostics", () => {
    const adapter = createProviderAdapter(compileSeedDefinition("SpareBank 1"));
    const statement = createCsvStatement(
      [
        "Dato;Beløp;Avsender;Mottaker;Beskrivelse",
        "16.01.2026;250,00;Kari Nordmann;Rema 1000;Rema 1000 Sentrum",
        "reservert;50,00;Kari Nordmann;Rema 1000;Reservert kjøp",
        "17.01.2026;250,00,00;Kari Nordmann;Rema 1000;Ugyldig beløp",
      ].join("\n"),
    );

    const detection = adapter.detect(statement);
    expect(detection.requiredMatches).toBe(detection.requiredTotal);

    const parsed = adapter.parse(statement);
    expect(parsed.rows).toEqual([
      {
        bookingDate: "2026-01-16",
        amountNok: 250,
        currency: "NOK",
        sender: "Kari Nordmann",
        recipient: "Rema 1000",
        name: "",
        title: "Rema 1000 Sentrum",
        paymentType: "",
      },
    ]);
    expect(parsed.errors).toEqual([
      {
        rowNumber: 4,
        code: "INVALID_AMOUNT",
        message:
          'Row 4 has invalid amount "250,00,00". Expected decimal format using "," as the decimal separator.',
      },
    ]);
    expect(parsed.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 1,
      invalid: 1,
    });
  });
});

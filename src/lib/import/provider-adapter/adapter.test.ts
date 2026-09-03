import { describe, expect, it } from "vitest";
import { createProviderAdapter } from "./adapter";
import { compileProviderMapping } from "./compile-mapping";
import { createCsvStatement } from "./csv-statement";
import {
  COMMA_QUOTED_CSV,
  NORDIC_SEMICOLON_CSV,
  RESERVED_ROW_WITH_BLANK_LINE_CSV,
} from "./fixtures";
import type { ProviderMappingRecord } from "./mapping-definition";

function buildRecord(
  overrides: Partial<ProviderMappingRecord> = {},
): ProviderMappingRecord {
  return {
    id: "provider-1",
    providerName: "Nordic Bank",
    mappingVersion: 1,
    normalizationRules: {},
    fieldMappings: [
      {
        sourceField: "Bokføringsdato",
        canonicalField: "bookingDate",
        transformRules: null,
      },
      { sourceField: "Beløp", canonicalField: "amount", transformRules: null },
      {
        sourceField: "Avsender",
        canonicalField: "sender",
        transformRules: null,
      },
      {
        sourceField: "Mottaker",
        canonicalField: "recipient",
        transformRules: null,
      },
      {
        sourceField: "Beskrivelse",
        canonicalField: "name",
        transformRules: null,
      },
      { sourceField: "Melding", canonicalField: "title", transformRules: null },
      {
        sourceField: "Valuta",
        canonicalField: "currency",
        transformRules: null,
      },
      {
        sourceField: "Betalingstype",
        canonicalField: "paymentType",
        transformRules: null,
      },
    ],
    ...overrides,
  };
}

function buildAdapter(overrides: Partial<ProviderMappingRecord> = {}) {
  const compiled = compileProviderMapping(buildRecord(overrides));
  if (!compiled.ok) {
    throw new Error(`Expected mapping to compile: ${compiled.error.message}`);
  }
  return createProviderAdapter(compiled.definition);
}

describe("createProviderAdapter", () => {
  it("detects a semicolon Nordic-header statement as certain and parses it into a canonical NOK row through the same adapter", () => {
    const adapter = buildAdapter();
    const statement = createCsvStatement(NORDIC_SEMICOLON_CSV);

    const detection = adapter.detect(statement);
    expect(detection.requiredMatches).toBe(detection.requiredTotal);
    expect(detection.requiredTotal).toBeGreaterThan(0);

    const parsed = adapter.parse(statement);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        bookingDate: "15.01.2026",
        amountNok: 1234.56,
        currency: "NOK",
        sender: "Alice",
        recipient: "ACME AS",
        name: "Dagligvarer",
        title: "Ukens handel",
        paymentType: "Kort",
      },
    ]);
    expect(parsed.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    });
  });

  it("a certain detection cannot then fail parsing with a contradictory missing-header diagnostic", () => {
    const adapter = buildAdapter();
    const statement = createCsvStatement(NORDIC_SEMICOLON_CSV);

    const detection = adapter.detect(statement);
    expect(detection.requiredMatches).toBe(detection.requiredTotal);

    const parsed = adapter.parse(statement);
    expect(
      parsed.errors.some((error) => error.code === "MISSING_REQUIRED_HEADERS"),
    ).toBe(false);
  });

  it("parses a comma-delimited statement with quoted delimiters correctly during both detection and parsing", () => {
    const adapter = buildAdapter({
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
          sourceField: "Beskrivelse",
          canonicalField: "name",
          transformRules: null,
        },
        {
          sourceField: "Melding",
          canonicalField: "title",
          transformRules: null,
        },
        {
          sourceField: "Valuta",
          canonicalField: "currency",
          transformRules: null,
        },
      ],
    });
    const statement = createCsvStatement(COMMA_QUOTED_CSV);

    const detection = adapter.detect(statement);
    expect(detection.requiredMatches).toBe(detection.requiredTotal);

    const parsed = adapter.parse(statement);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        bookingDate: "01.02.2026",
        amountNok: 1500,
        currency: "NOK",
        sender: "",
        recipient: "",
        name: "Rema 1000, Sentrum",
        title: "Ukentlig",
        paymentType: "",
      },
    ]);
  });

  it("returns a MISSING_REQUIRED_HEADERS diagnostic when mapped headers are absent from the statement", () => {
    const adapter = buildAdapter();
    const statement = createCsvStatement(
      "Bokføringsdato;Beløp\n15.01.2026;1234,56",
    );

    const parsed = adapter.parse(statement);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual([
      {
        rowNumber: 1,
        code: "MISSING_REQUIRED_HEADERS",
        message: "Missing required provider mapping headers for Nordic Bank.",
      },
    ]);
    expect(parsed.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    });
  });

  it("returns structured row-level diagnostics for invalid mapped values", () => {
    const adapter = buildAdapter();
    const statement = createCsvStatement(
      [
        "Bokføringsdato;Beløp;Avsender;Mottaker;Beskrivelse;Melding;Valuta;Betalingstype",
        "15.01.2026;abc;Alice;ACME AS;Dagligvarer;Ukens handel;NOK;Kort",
        "16.01.2026;100,00;Alice;ACME AS;Dagligvarer;Ukens handel;EUR;Kort",
      ].join("\n"),
    );

    const parsed = adapter.parse(statement);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual([
      {
        rowNumber: 2,
        code: "INVALID_AMOUNT",
        message:
          'Row 2 has invalid amount "abc". Expected Norwegian decimal format like 123,45.',
      },
      {
        rowNumber: 3,
        code: "INVALID_CURRENCY",
        message: 'Row 3 has unsupported currency "EUR". Only NOK is accepted.',
      },
    ]);
    expect(parsed.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 2,
    });
  });

  it("ignores reserved booking-date rows and counts them separately from errors, honoring blank lines", () => {
    const adapter = buildAdapter({
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
          sourceField: "Beskrivelse",
          canonicalField: "name",
          transformRules: null,
        },
        {
          sourceField: "Melding",
          canonicalField: "title",
          transformRules: null,
        },
        {
          sourceField: "Valuta",
          canonicalField: "currency",
          transformRules: null,
        },
      ],
    });
    const statement = createCsvStatement(RESERVED_ROW_WITH_BLANK_LINE_CSV);

    const parsed = adapter.parse(statement);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        bookingDate: "16.01.2026",
        amountNok: 250,
        currency: "NOK",
        sender: "",
        recipient: "",
        name: "Kiosk",
        title: "Snacks",
        paymentType: "",
      },
    ]);
    expect(parsed.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 1,
      invalid: 0,
    });
  });

  it("defaults omitted currency mapping to NOK", () => {
    const adapter = buildAdapter({
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
          sourceField: "Beskrivelse",
          canonicalField: "name",
          transformRules: null,
        },
      ],
    });
    const statement = createCsvStatement(
      "Bokføringsdato;Beløp;Beskrivelse\n15.01.2026;100,00;Dagligvarer",
    );

    const parsed = adapter.parse(statement);
    expect(parsed.rows).toEqual([
      {
        bookingDate: "15.01.2026",
        amountNok: 100,
        currency: "NOK",
        sender: "",
        recipient: "",
        name: "Dagligvarer",
        title: "",
        paymentType: "",
      },
    ]);
  });

  it("scores detection using requiredCoverage + optionalCoverage * 0.5 + patternMatches * 0.25, rounded to 4 decimals", () => {
    const adapter = buildAdapter({
      normalizationRules: {
        requiredHeaders: ["Bokføringsdato", "Beløp", "Betalingstype"],
        anyHeaders: ["Valuta"],
        headerPatterns: ["Bokføringsdato;Beløp"],
      },
    });
    const statement = createCsvStatement(NORDIC_SEMICOLON_CSV);

    const detection = adapter.detect(statement);

    // requiredCoverage 1 + optionalCoverage(1) * 0.5 + patternMatches(1) * 0.25 = 1.75
    expect(detection.score).toBe(1.75);
    expect(detection.requiredMatches).toBe(3);
    expect(detection.requiredTotal).toBe(3);
    expect(detection.patternMatches).toBe(1);
  });

  it("falls back to mapped source headers as the required set when requiredHeaders is empty", () => {
    const adapter = buildAdapter({ normalizationRules: {} });
    const statement = createCsvStatement(NORDIC_SEMICOLON_CSV);

    const detection = adapter.detect(statement);

    expect(detection.requiredTotal).toBe(8);
    expect(detection.requiredMatches).toBe(8);
  });
});

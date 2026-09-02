import { describe, expect, it } from "vitest";
import { compileProviderAdapter } from "./adapter";
import { tokenizeCsv } from "./csv-tokenizer";
import { compileProviderMappingDefinition } from "./mapping-definition";

function compile(overrides: {
  normalizationRules?: Record<string, unknown>;
  fieldMappings: Array<{
    sourceField: string;
    canonicalField: string;
    transformRules?: unknown;
  }>;
  providerName?: string;
}) {
  const definition = compileProviderMappingDefinition({
    id: "provider-1",
    providerName: overrides.providerName ?? "Bank B",
    mappingVersion: 1,
    normalizationRules: overrides.normalizationRules ?? {},
    fieldMappings: overrides.fieldMappings,
  });

  return compileProviderAdapter(definition);
}

const fullMapping = [
  { sourceField: "Dato", canonicalField: "bookingDate" },
  { sourceField: "Belastning", canonicalField: "amount" },
  { sourceField: "Fra", canonicalField: "sender" },
  { sourceField: "Til", canonicalField: "recipient" },
  { sourceField: "Beskrivelse", canonicalField: "name" },
  { sourceField: "Melding", canonicalField: "title" },
  { sourceField: "Valuta", canonicalField: "currency" },
  { sourceField: "Type", canonicalField: "paymentType" },
];

describe("provider adapter: detection and parsing consistency", () => {
  it("parses successfully once detection reports a certain match for the same fixture", () => {
    const adapter = compile({ fieldMappings: fullMapping });
    const csvContent =
      "Dato;Belastning;Fra;Til;Beskrivelse;Melding;Valuta;Type\n2026-01-01;123,45;Alice;Shop A;Groceries;Friday;NOK;Kort";

    const csv = tokenizeCsv(csvContent);
    if (!csv) throw new Error("expected a tokenized CSV");
    const detection = adapter.detect(csv);
    expect(detection.requiredMatches).toBe(detection.requiredTotal);

    const parsed = adapter.parse(csvContent);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        bookingDate: "2026-01-01",
        amountNok: 123.45,
        currency: "NOK",
        sender: "Alice",
        recipient: "Shop A",
        name: "Groceries",
        title: "Friday",
        paymentType: "Kort",
      },
    ]);
  });

  it("normalizes Nordic header characters identically for detection and extraction", () => {
    const adapter = compile({
      fieldMappings: [
        { sourceField: "Bokføringsdato", canonicalField: "bookingDate" },
        { sourceField: "Beløp", canonicalField: "amount" },
        { sourceField: "Tittel", canonicalField: "title" },
      ],
    });
    const csvContent =
      "BOKFØRINGSDATO;BELØP;TITTEL\n2026-01-01;100,00;Groceries";

    const csv = tokenizeCsv(csvContent);
    if (!csv) throw new Error("expected a tokenized CSV");
    expect(adapter.detect(csv).requiredMatches).toBe(
      adapter.detect(csv).requiredTotal,
    );

    const parsed = adapter.parse(csvContent);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].bookingDate).toBe("2026-01-01");
  });

  it("agrees on the header row across blank lines and a preamble", () => {
    const adapter = compile({ fieldMappings: fullMapping });
    const csvContent = [
      "",
      "Statement export",
      "",
      "Dato;Belastning;Fra;Til;Beskrivelse;Melding;Valuta;Type",
      "2026-01-01;123,45;Alice;Shop A;Groceries;Friday;NOK;Kort",
    ].join("\r\n");

    const csv = tokenizeCsv(csvContent);
    if (!csv) throw new Error("expected a tokenized CSV");
    expect(adapter.detect(csv).requiredMatches).toBe(
      adapter.detect(csv).requiredTotal,
    );

    const parsed = adapter.parse(csvContent);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
  });
});

describe("provider adapter: CSV lexical handling", () => {
  it("parses quoted delimiters and escaped quotes for a comma-delimited statement", () => {
    const adapter = compile({
      normalizationRules: { delimiter: ",", decimalSeparator: "." },
      fieldMappings: [
        { sourceField: "Date", canonicalField: "bookingDate" },
        { sourceField: "Amount", canonicalField: "amount" },
        { sourceField: "Title", canonicalField: "title" },
      ],
    });
    const csvContent =
      'Date,Amount,Title\n2026-01-01,"1,234.56","Say ""hi"", pal"';

    const parsed = adapter.parse(csvContent);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].amountNok).toBe(1234.56);
    expect(parsed.rows[0].title).toBe('Say "hi", pal');
  });
});

describe("provider adapter: decimal separators", () => {
  it("parses comma-decimal amounts with period thousands separators", () => {
    const adapter = compile({
      normalizationRules: { decimalSeparator: "," },
      fieldMappings: [
        { sourceField: "Dato", canonicalField: "bookingDate" },
        { sourceField: "Beløp", canonicalField: "amount" },
        { sourceField: "Tittel", canonicalField: "title" },
      ],
    });

    const parsed = adapter.parse(
      "Dato;Beløp;Tittel\n2026-01-01;1.234,56;Big purchase",
    );

    expect(parsed.rows[0].amountNok).toBe(1234.56);
  });

  it("parses period-decimal amounts with comma thousands separators", () => {
    const adapter = compile({
      normalizationRules: { decimalSeparator: "." },
      fieldMappings: [
        { sourceField: "Date", canonicalField: "bookingDate" },
        { sourceField: "Amount", canonicalField: "amount" },
        { sourceField: "Title", canonicalField: "title" },
      ],
    });

    const parsed = adapter.parse(
      "Date;Amount;Title\n2026-01-01;1,234.56;Big purchase",
    );

    expect(parsed.rows[0].amountNok).toBe(1234.56);
  });

  it("returns a structured diagnostic for a malformed amount", () => {
    const adapter = compile({
      fieldMappings: [
        { sourceField: "Dato", canonicalField: "bookingDate" },
        { sourceField: "Beløp", canonicalField: "amount" },
        { sourceField: "Tittel", canonicalField: "title" },
      ],
    });

    const parsed = adapter.parse(
      "Dato;Beløp;Tittel\n2026-01-01;not-a-number;Groceries",
    );

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual([
      {
        rowNumber: 2,
        code: "INVALID_AMOUNT",
        message:
          'Row 2 has invalid amount "not-a-number". Expected decimal format using "," as the separator.',
      },
    ]);
  });
});

describe("provider adapter: currency", () => {
  it("defaults an omitted currency field to NOK", () => {
    const adapter = compile({
      fieldMappings: [
        { sourceField: "Dato", canonicalField: "bookingDate" },
        { sourceField: "Beløp", canonicalField: "amount" },
        { sourceField: "Tittel", canonicalField: "title" },
      ],
    });

    const parsed = adapter.parse("Dato;Beløp;Tittel\n2026-01-01;100,00;Rent");

    expect(parsed.rows[0].currency).toBe("NOK");
  });

  it("rejects a non-NOK currency value with a structured diagnostic", () => {
    const adapter = compile({ fieldMappings: fullMapping });

    const parsed = adapter.parse(
      "Dato;Belastning;Fra;Til;Beskrivelse;Melding;Valuta;Type\n2026-01-01;100,00;Alice;Shop A;Groceries;Friday;EUR;Kort",
    );

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual([
      {
        rowNumber: 2,
        code: "INVALID_CURRENCY",
        message: 'Row 2 has unsupported currency "EUR". Only NOK is accepted.',
      },
    ]);
  });
});

describe("provider adapter: reserved rows", () => {
  it("ignores rows with a reserved booking date without treating them as errors", () => {
    const adapter = compile({
      fieldMappings: [
        { sourceField: "Dato", canonicalField: "bookingDate" },
        { sourceField: "Beløp", canonicalField: "amount" },
        { sourceField: "Tittel", canonicalField: "title" },
      ],
    });

    const parsed = adapter.parse(
      "Dato;Beløp;Tittel\nReservert;100,00;Pending\n2026-01-02;50,00;Coffee",
    );

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 1,
      invalid: 0,
    });
  });
});

describe("provider adapter: field transforms", () => {
  it("applies trim, case conversion, valueMap, and sign transforms in order", () => {
    const adapter = compile({
      fieldMappings: [
        { sourceField: "Dato", canonicalField: "bookingDate" },
        {
          sourceField: "Beløp",
          canonicalField: "amount",
          transformRules: [{ type: "sign", value: "negative" }],
        },
        {
          sourceField: "Tittel",
          canonicalField: "title",
          transformRules: [{ type: "trim" }, { type: "uppercase" }],
        },
        {
          sourceField: "Type",
          canonicalField: "paymentType",
          transformRules: [
            {
              type: "valueMap",
              values: { "VISA KORT": "kort" },
              fallback: "annet",
            },
          ],
        },
      ],
    });

    const parsed = adapter.parse(
      "Dato;Beløp;Tittel;Type\n2026-01-01;100,00;  groceries  ;VISA KORT",
    );

    expect(parsed.rows[0]).toMatchObject({
      amountNok: -100,
      title: "GROCERIES",
      paymentType: "kort",
    });
  });

  it("uses the valueMap fallback for an unrecognized provider label", () => {
    const adapter = compile({
      fieldMappings: [
        { sourceField: "Dato", canonicalField: "bookingDate" },
        { sourceField: "Beløp", canonicalField: "amount" },
        { sourceField: "Tittel", canonicalField: "title" },
        {
          sourceField: "Type",
          canonicalField: "paymentType",
          transformRules: [
            {
              type: "valueMap",
              values: { "VISA KORT": "kort" },
              fallback: "annet",
            },
          ],
        },
      ],
    });

    const parsed = adapter.parse(
      "Dato;Beløp;Tittel;Type\n2026-01-01;100,00;Groceries;Unknown Label",
    );

    expect(parsed.rows[0].paymentType).toBe("annet");
  });
});

describe("provider adapter: missing headers", () => {
  it("returns MISSING_REQUIRED_HEADERS when a required mapped header is absent from the file", () => {
    const adapter = compile({ fieldMappings: fullMapping });

    const parsed = adapter.parse("Dato;Fra\n2026-01-01;Alice");

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual([
      {
        rowNumber: 1,
        code: "MISSING_REQUIRED_HEADERS",
        message: "Missing required provider mapping headers for Bank B.",
      },
    ]);
  });
});

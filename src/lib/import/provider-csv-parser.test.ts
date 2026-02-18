import { describe, expect, it } from "vitest";
import { parseProviderMappedCsv } from "./provider-csv-parser";

const mapping = {
  id: "provider-1",
  providerName: "Bank B",
  normalizationRules: {},
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
    { sourceField: "Fra", canonicalField: "sender", transformRules: null },
    { sourceField: "Til", canonicalField: "recipient", transformRules: null },
    {
      sourceField: "Beskrivelse",
      canonicalField: "name",
      transformRules: null,
    },
    { sourceField: "Melding", canonicalField: "title", transformRules: null },
    { sourceField: "Valuta", canonicalField: "currency", transformRules: null },
    {
      sourceField: "Type",
      canonicalField: "paymentType",
      transformRules: null,
    },
  ],
} as const;

describe("parseProviderMappedCsv", () => {
  it("transforms provider rows into canonical parser rows", () => {
    const result = parseProviderMappedCsv(
      "Dato;Belastning;Fra;Til;Beskrivelse;Melding;Valuta;Type\n2026-01-01;123,45;Alice;Shop A;Groceries;Friday;NOK;Kort",
      mapping,
    );

    expect(result.rows).toEqual([
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
    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    });
    expect(result.errors).toEqual([]);
  });

  it("returns structured row-level validation errors for invalid mapped values", () => {
    const result = parseProviderMappedCsv(
      "Dato;Belastning;Fra;Til;Beskrivelse;Melding;Valuta;Type\n2026-01-01;abc;Alice;Shop A;Groceries;Friday;NOK;Kort\n2026-01-02;100,00;Alice;Shop B;Train;Commute;EUR;Kort",
      mapping,
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
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
    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 2,
    });
  });

  it("returns missing-header diagnostics when mapping headers are incomplete", () => {
    const result = parseProviderMappedCsv(
      "Dato;Belastning;Fra\n2026-01-01;123,45;Alice",
      mapping,
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      {
        rowNumber: 1,
        code: "MISSING_REQUIRED_HEADERS",
        message: "Missing required provider mapping headers for Bank B.",
      },
    ]);
    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    });
  });
});

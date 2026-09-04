import { describe, expect, it } from "vitest";

import { parseNorwegianBankCsv } from "../csv-parser";
import {
  BUILT_IN_NORWEGIAN_PROVIDER_ID,
  createBuiltInNorwegianAdapter,
} from "./built-in-norwegian";
import { createCsvStatement } from "./csv-statement";

const HEADER =
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype";
const ENGLISH_HEADER =
  "BookingDate;Amount;Sender;Recipient;Name;Title;Currency;PaymentType";

function parseWithAdapter(csv: string) {
  return createBuiltInNorwegianAdapter().parse(createCsvStatement(csv));
}

describe("createBuiltInNorwegianAdapter", () => {
  it("exposes a stable provider identity", () => {
    const adapter = createBuiltInNorwegianAdapter();

    expect(adapter.providerId).toBe(BUILT_IN_NORWEGIAN_PROVIDER_ID);
    expect(adapter.providerId).toBe("built-in:norwegian");
    expect(adapter.providerName.length).toBeGreaterThan(0);
  });

  describe("parse", () => {
    it("parses valid NOK rows and returns the import summary", () => {
      const csv = [
        HEADER,
        "01.01.2026;1 234,56;Alice;Shop;Groceries;Store run;NOK;Kort",
      ].join("\n");

      const result = parseWithAdapter(csv);

      expect(result.errors).toEqual([]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        bookingDate: "01.01.2026",
        amountNok: 1234.56,
        currency: "NOK",
        sender: "Alice",
        recipient: "Shop",
        name: "Groceries",
        title: "Store run",
        paymentType: "Kort",
      });
      expect(result.summary).toEqual({
        imported: 1,
        duplicates: 0,
        ignoredReserved: 0,
        invalid: 0,
      });
    });

    it("ignores rows marked as Reservert and counts them in the summary", () => {
      const csv = [HEADER, "Reservert;100,00;A;B;C;D;NOK;Kort"].join("\n");

      const result = parseWithAdapter(csv);

      expect(result.rows).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.summary).toEqual({
        imported: 0,
        duplicates: 0,
        ignoredReserved: 1,
        invalid: 0,
      });
    });

    it("reports non-NOK rows as invalid currency errors with the existing message", () => {
      const csv = [HEADER, "02.01.2026;20,00;A;B;C;D;USD;Kort"].join("\n");

      const result = parseWithAdapter(csv);

      expect(result.rows).toEqual([]);
      expect(result.errors).toEqual([
        {
          rowNumber: 2,
          code: "INVALID_CURRENCY",
          message:
            'Row 2 has unsupported currency "USD". Only NOK is accepted.',
        },
      ]);
      expect(result.summary).toEqual({
        imported: 0,
        duplicates: 0,
        ignoredReserved: 0,
        invalid: 1,
      });
    });

    it("accepts an explicit NOK currency case-insensitively", () => {
      const csv = [HEADER, "02.01.2026;20,00;A;B;C;D;nok;Kort"].join("\n");

      const result = parseWithAdapter(csv);

      expect(result.errors).toEqual([]);
      expect(result.rows[0]?.currency).toBe("NOK");
    });

    it("reports invalid amounts with the existing message and code", () => {
      const csv = [HEADER, "02.01.2026;abc;A;B;C;D;NOK;Kort"].join("\n");

      const result = parseWithAdapter(csv);

      expect(result.rows).toEqual([]);
      expect(result.errors).toEqual([
        {
          rowNumber: 2,
          code: "INVALID_AMOUNT",
          message:
            'Row 2 has invalid amount "abc". Expected Norwegian decimal format like 123,45.',
        },
      ]);
      expect(result.summary.invalid).toBe(1);
    });

    it("reports rows with too few columns as INVALID_COLUMN_COUNT", () => {
      const csv = [HEADER, "02.01.2026;20,00;A;B;C"].join("\n");

      const result = parseWithAdapter(csv);

      expect(result.errors).toEqual([
        {
          rowNumber: 2,
          code: "INVALID_COLUMN_COUNT",
          message:
            "Row 2 has too few columns for the expected semicolon format.",
        },
      ]);
    });

    it("returns MISSING_REQUIRED_HEADERS for empty input", () => {
      const result = parseWithAdapter("");

      expect(result.rows).toEqual([]);
      expect(result.errors).toEqual([
        {
          rowNumber: 1,
          code: "MISSING_REQUIRED_HEADERS",
          message:
            "CSV is empty. Expected headers include Bokføringsdato, Beløp, Valuta and Betalingstype.",
        },
      ]);
      expect(result.summary).toEqual({
        imported: 0,
        duplicates: 0,
        ignoredReserved: 0,
        invalid: 1,
      });
    });

    it("returns MISSING_REQUIRED_HEADERS when a required header is missing", () => {
      const csv = [
        "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Valuta;Betalingstype",
        "01.01.2026;100,00;A;B;C;NOK;Kort",
      ].join("\n");

      const result = parseWithAdapter(csv);

      expect(result.rows).toEqual([]);
      expect(result.errors).toEqual([
        {
          rowNumber: 1,
          code: "MISSING_REQUIRED_HEADERS",
          message:
            "Missing required CSV headers. Expected Bokføringsdato, Beløp, Avsender, Mottaker, Navn, Tittel, Valuta, Betalingstype.",
        },
      ]);
    });

    it("recognizes the English header aliases", () => {
      const csv = [
        ENGLISH_HEADER,
        "01.01.2026;100,00;Alice;Shop;Groceries;Store run;NOK;Kort",
      ].join("\n");

      const result = parseWithAdapter(csv);

      expect(result.errors).toEqual([]);
      expect(result.rows).toHaveLength(1);
    });

    it("produces the exact same rows, errors and summary as parseNorwegianBankCsv for representative fixtures", () => {
      const fixtures = [
        "",
        [
          HEADER,
          "01.01.2026;1 234,56;Alice;Shop;Groceries;Store run;NOK;Kort",
          "Reservert;100,00;A;B;C;D;NOK;Kort",
          "02.01.2026;20,00;A;B;C;D;USD;Kort",
          "02.01.2026;abc;A;B;C;D;NOK;Kort",
        ].join("\n"),
        [ENGLISH_HEADER, "15.02.2026;50,00;A;B;C;D;NOK;Vipps"].join("\n"),
      ];

      for (const csv of fixtures) {
        expect(parseWithAdapter(csv)).toEqual(parseNorwegianBankCsv(csv));
      }
    });
  });

  describe("detect", () => {
    it("scores a full Nordic header match as a certain candidate", () => {
      const csv = [
        HEADER,
        "01.01.2026;100,00;Alice;Shop;Groceries;Store run;NOK;Kort",
      ].join("\n");

      const candidate = createBuiltInNorwegianAdapter().detect(
        createCsvStatement(csv),
      );

      expect(candidate.providerId).toBe(BUILT_IN_NORWEGIAN_PROVIDER_ID);
      expect(candidate.requiredMatches).toBe(8);
      expect(candidate.requiredTotal).toBe(8);
      expect(candidate.patternMatches).toBe(0);
      expect(candidate.score).toBe(1);
    });

    it("scores the English header aliases the same as the Nordic headers", () => {
      const csv = [
        ENGLISH_HEADER,
        "01.01.2026;100,00;Alice;Shop;Groceries;Store run;NOK;Kort",
      ].join("\n");

      const candidate = createBuiltInNorwegianAdapter().detect(
        createCsvStatement(csv),
      );

      expect(candidate.requiredMatches).toBe(8);
      expect(candidate.score).toBe(1);
    });

    it("scores a partial header match proportionally", () => {
      const csv = [
        "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Valuta;Betalingstype",
        "01.01.2026;100,00;A;B;C;NOK;Kort",
      ].join("\n");

      const candidate = createBuiltInNorwegianAdapter().detect(
        createCsvStatement(csv),
      );

      expect(candidate.requiredMatches).toBe(7);
      expect(candidate.requiredTotal).toBe(8);
      expect(candidate.score).toBe(0.875);
    });
  });
});

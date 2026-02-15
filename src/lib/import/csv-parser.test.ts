import { describe, expect, it } from "vitest";

import { parseNorwegianBankCsv } from "./csv-parser";

const HEADER =
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype";

describe("parseNorwegianBankCsv", () => {
  it("parses valid NOK rows and returns import summary", () => {
    const csv = [
      HEADER,
      "01.01.2026;1 234,56;Alice;Shop;Groceries;Store run;NOK;Kort",
    ].join("\n");

    const result = parseNorwegianBankCsv(csv);

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

  it("ignores rows marked as Reservert and counts them in summary", () => {
    const csv = [HEADER, "Reservert;100,00;A;B;C;D;NOK;Kort"].join("\n");

    const result = parseNorwegianBankCsv(csv);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 1,
      invalid: 0,
    });
  });

  it("reports non-NOK rows as invalid currency errors", () => {
    const csv = [HEADER, "02.01.2026;20,00;A;B;C;D;USD;Kort"].join("\n");

    const result = parseNorwegianBankCsv(csv);

    expect(result.rows).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      rowNumber: 2,
      code: "INVALID_CURRENCY",
    });
    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    });
  });

  it("returns missing-header diagnostics for empty input", () => {
    const result = parseNorwegianBankCsv("");

    expect(result.rows).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      rowNumber: 1,
      code: "MISSING_REQUIRED_HEADERS",
    });
    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    });
  });
});

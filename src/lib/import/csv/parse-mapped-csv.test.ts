import { describe, expect, it } from "vitest";
import type { ColumnMapping } from "./column-mapping";
import { parseMappedCsv, readCsvTable } from "./parse-mapped-csv";

const NORDEA_CSV = [
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype",
  "01.01.2026;-1 234,56;Alice;Shop;Rema 1000;Varekjøp;NOK;Kort",
  "Reservert;-100,00;Alice;Shop;Kiwi;Varekjøp;NOK;Kort",
  "02.01.2026;abc;Alice;Shop;Vy;Billett;NOK;Kort",
  "2026-01-03;-50,00;Alice;Shop;Ruter;Billett;NOK;Kort",
].join("\n");

const NORDEA_MAPPING: ColumnMapping = {
  date: { index: 0, header: "Bokføringsdato" },
  amount: { kind: "signed", column: { index: 1, header: "Beløp" } },
  description: [
    { index: 4, header: "Navn" },
    { index: 5, header: "Tittel" },
  ],
  paymentType: { index: 7, header: "Betalingstype" },
};

const DNB_CSV = [
  '"Dato";"Forklaring";"Rentedato";"Ut fra konto";"Inn på konto"',
  '"02.01.2026";"Kiwi Majorstuen";"02.01.2026";"249,90";""',
  '"03.01.2026";"Lønn";"03.01.2026";"";"35 000,00"',
  '"04.01.2026";"Tom rad";"04.01.2026";"";""',
].join("\n");

const DNB_MAPPING: ColumnMapping = {
  date: { index: 0, header: "Dato" },
  amount: {
    kind: "split",
    inflow: { index: 4, header: "Inn på konto" },
    outflow: { index: 3, header: "Ut fra konto" },
  },
  description: [{ index: 1, header: "Forklaring" }],
};

describe("readCsvTable", () => {
  it("returns the header cells and the data rows with their file line numbers", () => {
    const table = readCsvTable(DNB_CSV);

    expect(table.headers).toEqual([
      "Dato",
      "Forklaring",
      "Rentedato",
      "Ut fra konto",
      "Inn på konto",
    ]);
    expect(table.rows[0]).toEqual({
      sourceRowNumber: 2,
      cells: ["02.01.2026", "Kiwi Majorstuen", "02.01.2026", "249,90", ""],
    });
  });
});

describe("parseMappedCsv", () => {
  it("joins description columns, reads a signed amount and skips Reservert rows", () => {
    const result = parseMappedCsv(readCsvTable(NORDEA_CSV), NORDEA_MAPPING);

    expect(result.rows).toEqual([
      {
        bookingDate: "2026-01-01",
        amountNok: -1234.56,
        currency: "NOK",
        sender: "",
        recipient: "",
        name: "",
        title: "Rema 1000 Varekjøp",
        paymentType: "Kort",
      },
    ]);
    expect(result.errors).toEqual([
      {
        rowNumber: 4,
        code: "INVALID_AMOUNT",
        message:
          'Row 4 has invalid amount "abc". Expected a number using "," as the decimal separator.',
      },
      {
        rowNumber: 5,
        code: "INVALID_BOOKING_DATE",
        message:
          'Row 5 has booking date "2026-01-03" that does not match the format DD.MM.YYYY.',
      },
    ]);
    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 1,
      invalid: 2,
    });
  });

  it("subtracts the outflow column from the inflow column for split amounts", () => {
    const result = parseMappedCsv(readCsvTable(DNB_CSV), DNB_MAPPING);

    expect(
      result.rows.map((row) => [row.bookingDate, row.amountNok, row.title]),
    ).toEqual([
      ["2026-01-02", -249.9, "Kiwi Majorstuen"],
      ["2026-01-03", 35000, "Lønn"],
    ]);
    expect(result.rows[0].paymentType).toBe("");
    expect(result.errors).toEqual([
      {
        rowNumber: 4,
        code: "INVALID_AMOUNT",
        message:
          'Row 4 has invalid amount "". Expected a number using "," as the decimal separator.',
      },
    ]);
  });

  it("treats an outflow written with a minus sign the same as one without", () => {
    const csv = ["Dato;Tekst;Ut;Inn", "05.01.2026;Kiosk;-49,00;"].join("\n");
    const result = parseMappedCsv(readCsvTable(csv), {
      date: { index: 0, header: "Dato" },
      amount: {
        kind: "split",
        inflow: { index: 3, header: "Inn" },
        outflow: { index: 2, header: "Ut" },
      },
      description: [{ index: 1, header: "Tekst" }],
    });

    expect(result.rows[0].amountNok).toBe(-49);
  });

  it("infers ISO dates, period decimals and comma delimiters from the file", () => {
    const csv = [
      "Date,Description,Amount",
      '2026-02-28,"Rema 1000, Sentrum","-1,234.56"',
    ].join("\n");
    const result = parseMappedCsv(readCsvTable(csv), {
      date: { index: 0, header: "Date" },
      amount: { kind: "signed", column: { index: 2, header: "Amount" } },
      description: [{ index: 1, header: "Description" }],
    });

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      bookingDate: "2026-02-28",
      amountNok: -1234.56,
      title: "Rema 1000, Sentrum",
    });
  });
});

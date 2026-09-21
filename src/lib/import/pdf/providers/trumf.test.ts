import { describe, expect, it } from "vitest";

import trumfJanuary from "../__fixtures__/trumf-2026-01.json";
import trumfSeptember from "../__fixtures__/trumf-2026-09.json";
import { type StatementItem, statementDriftNok } from "../statement-items";
import { trumfPdfStatementExtractor } from "./trumf";

function withoutLine(
  fixture: unknown,
  page: number,
  y: number,
): StatementItem[] {
  return (fixture as StatementItem[]).filter(
    (item) => !(item.page === page && item.y === y),
  );
}

const september = trumfSeptember as StatementItem[];
const january = trumfJanuary as StatementItem[];

describe("trumfPdfStatementExtractor.detect", () => {
  it("recognizes a statement carrying the issuer letterhead", () => {
    expect(trumfPdfStatementExtractor.detect(september)).toBe(true);
  });

  it("rejects a statement from another issuer", () => {
    expect(
      trumfPdfStatementExtractor.detect([
        { page: 1, y: 800, x: 20, text: "Some other bank AS" },
      ]),
    ).toBe(false);
  });
});

describe("trumfPdfStatementExtractor.extract", () => {
  it("extracts every transaction in the September statement and balances", () => {
    const { parsed, reconciliation } =
      trumfPdfStatementExtractor.extract(september);

    expect(parsed.rows).toHaveLength(39);
    expect(parsed.errors).toEqual([]);
    expect(parsed.summary).toEqual({
      imported: 39,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    });
    expect(reconciliation).toEqual({
      openingNok: -10000,
      movementNok: 8907.94,
      closingNok: -1092.06,
    });
    expect(reconciliation && statementDriftNok(reconciliation)).toBe(0);
  });

  it("extracts every transaction in the January statement and balances", () => {
    const { parsed, reconciliation } =
      trumfPdfStatementExtractor.extract(january);

    expect(parsed.rows).toHaveLength(30);
    expect(reconciliation).toEqual({
      openingNok: -10000,
      movementNok: -34790.93,
      closingNok: -44790.93,
    });
    expect(reconciliation && statementDriftNok(reconciliation)).toBe(0);
  });

  it("fills the row fields the import review pipeline reads", () => {
    const { parsed } = trumfPdfStatementExtractor.extract(january);

    expect(parsed.rows[0]).toEqual({
      bookingDate: "16.12.2025",
      amountNok: 57514.86,
      currency: "NOK",
      sender: "",
      recipient: "",
      name: "",
      title: "NORDVIK 101 Testveien TESTBY",
      paymentType: "Kort",
    });
  });

  it("keeps a charge negative as printed", () => {
    const { parsed } = trumfPdfStatementExtractor.extract(january);
    const charge = parsed.rows.filter(
      (row) =>
        row.bookingDate === "15.01.2026" &&
        row.title === "SOLBERG Testsenter TESTBY",
    );

    expect(charge).toHaveLength(1);
    expect(charge[0].amountNok).toBe(-633.17);
  });

  it("keeps a credit positive as printed", () => {
    const { parsed } = trumfPdfStatementExtractor.extract(january);
    const credit = parsed.rows.filter(
      (row) =>
        row.bookingDate === "16.12.2025" &&
        row.title === "NORDVIK 101 Testveien TESTBY",
    );

    expect(credit).toHaveLength(1);
    expect(credit[0].amountNok).toBe(57514.86);
  });

  it("appends a wrapped specification fragment to the row above it", () => {
    const { parsed } = trumfPdfStatementExtractor.extract(january);
    const wrapped = parsed.rows.filter(
      (row) => row.bookingDate === "06.01.2026",
    );

    expect(wrapped).toHaveLength(1);
    expect(wrapped[0].title).toBe(
      "Kamp.Test*eu-testpmnt-00 Testbill.Info 11.57.25",
    );
    expect(wrapped[0].amountNok).toBe(-68.92);
  });

  it("drops the summary, header and card-number lines out of the rows", () => {
    const { parsed } = trumfPdfStatementExtractor.extract(september);
    const titles = parsed.rows.map((row) => row.title).join("\n");

    for (const label of [
      "Nytt skyldig beløp",
      "Totalt skyldig beløp forrige periode",
      "Kortnummer",
      "Spesifikasjon",
      "Bokf. dato",
      "Kjøpsdato",
      "Transaksjonsoversikt",
      "Beløp i NOK",
    ]) {
      expect(titles).not.toContain(label);
    }
  });

  // The page 3 interest table reuses anonymized merchant names, so its
  // exclusion is only observable through the row count and a zero drift.
  it("excludes the page 3 interest table", () => {
    const { parsed, reconciliation } =
      trumfPdfStatementExtractor.extract(september);

    expect(parsed.rows).toHaveLength(39);
    expect(reconciliation && statementDriftNok(reconciliation)).toBe(0);
  });

  it("reports the missing amount as drift when a transaction line is lost", () => {
    // p2 y127 is the "18.12.25 granli.test - aaaaaa Oslo -965,85" row.
    const { parsed, reconciliation } = trumfPdfStatementExtractor.extract(
      withoutLine(trumfJanuary, 2, 127),
    );

    expect(parsed.rows).toHaveLength(29);
    expect(reconciliation && statementDriftNok(reconciliation)).toBe(965.85);
  });
});

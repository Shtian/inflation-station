import { describe, expect, it } from "vitest";

import amexSeptember from "../__fixtures__/amex-2026-09.json";
import { type StatementItem, statementDriftNok } from "../statement-items";
import { amexPdfStatementExtractor } from "./amex";

function withoutLine(
  fixture: unknown,
  page: number,
  y: number,
): StatementItem[] {
  return (fixture as StatementItem[]).filter(
    (item) => !(item.page === page && item.y === y),
  );
}

const september = amexSeptember as StatementItem[];

describe("amexPdfStatementExtractor.detect", () => {
  it("recognizes a statement carrying the issuer letterhead", () => {
    expect(amexPdfStatementExtractor.detect(september)).toBe(true);
  });

  it("rejects a statement from another issuer", () => {
    expect(
      amexPdfStatementExtractor.detect([
        { page: 1, y: 800, x: 20, text: "Some other bank AS" },
      ]),
    ).toBe(false);
  });
});

describe("amexPdfStatementExtractor.extract", () => {
  it("extracts every transaction in the September statement and balances", () => {
    const { parsed, reconciliation } =
      amexPdfStatementExtractor.extract(september);

    expect(parsed.rows).toHaveLength(9);
    expect(parsed.errors).toEqual([]);
    expect(parsed.summary).toEqual({
      imported: 9,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    });
    expect(reconciliation).toEqual({
      openingNok: 20000,
      movementNok: 8371.81,
      closingNok: 28371.81,
    });
    expect(reconciliation && statementDriftNok(reconciliation)).toBe(0);
  });

  it("negates a printed charge into the app's money-out sign", () => {
    const { parsed } = amexPdfStatementExtractor.extract(september);
    const charge = parsed.rows.filter(
      (row) => row.title === "AASEN.TEST XXXXXXXXXXX TESTBY",
    );

    expect(charge).toHaveLength(1);
    expect(charge[0]).toEqual({
      bookingDate: "13.09.2026",
      amountNok: -628.72,
      currency: "NOK",
      sender: "",
      recipient: "",
      name: "",
      title: "AASEN.TEST XXXXXXXXXXX TESTBY",
      paymentType: "Kort",
    });
  });

  it("negates a printed credit into the app's money-in sign", () => {
    const { parsed } = amexPdfStatementExtractor.extract(september);
    const credit = parsed.rows.filter(
      (row) => row.title === "NORDVIK 101 Testveien TESTBY",
    );

    expect(credit).toHaveLength(1);
    expect(credit[0].bookingDate).toBe("15.08.2026");
    expect(credit[0].amountNok).toBe(10000);
  });

  it("drops the table totals, headers and balance lines out of the rows", () => {
    const { parsed } = amexPdfStatementExtractor.extract(september);
    const titles = parsed.rows.map((row) => row.title).join("\n");

    for (const label of [
      "Sum nye betalinger",
      "Totalt nye transaksjoner",
      "Sum andre kontotransaksjoner",
      "Detaljer denne periode",
      "Beløp NOK",
      "-dato",
      "Saldo",
      "Rente",
    ]) {
      expect(titles).not.toContain(label);
    }
  });

  it("excludes the payment-example and interest tables", () => {
    const { parsed } = amexPdfStatementExtractor.extract(september);
    const titles = parsed.rows.map((row) => row.title).join("\n");

    // "Eksempel på betalingsalternativ" rows at p2 y156 and y120.
    expect(titles).not.toContain("Sp 0wtesters Eu");
    expect(titles).not.toContain("Myra Testland Unlimited Dublin 1");
    // Interest table at p2 y434, y419 and y403.
    expect(titles).not.toContain("Kroken Testmat 0000000_Kiosk Testby");
    expect(titles).not.toContain("FURULY TESTBY HFB MAIN TESTBY");
    expect(titles).not.toContain("Bekken*Testbutikk NO Stockholm");
  });

  it("reports the missing amount as drift when a transaction line is lost", () => {
    // p2 y523 is the "13.09.26 Medlemsavgift 628,72" row.
    const { parsed, reconciliation } = amexPdfStatementExtractor.extract(
      withoutLine(amexSeptember, 2, 523),
    );

    expect(parsed.rows).toHaveLength(8);
    expect(reconciliation && statementDriftNok(reconciliation)).toBe(-628.72);
  });
});

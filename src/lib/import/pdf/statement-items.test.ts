import { describe, expect, it } from "vitest";

import {
  groupStatementLines,
  labelledAmount,
  parseNorwegianAmount,
  type StatementItem,
  statementDriftNok,
  toBookingDate,
} from "./statement-items";

describe("groupStatementLines", () => {
  it("orders lines by page ascending then y descending", () => {
    const items: StatementItem[] = [
      { page: 2, y: 100, x: 10, text: "second page low" },
      { page: 1, y: 50, x: 10, text: "first page low" },
      { page: 1, y: 700, x: 10, text: "first page high" },
    ];

    expect(
      groupStatementLines(items).map((line) => line.items[0].text),
    ).toEqual(["first page high", "first page low", "second page low"]);
  });

  it("groups items sharing a page and y into one line ordered by x", () => {
    const items: StatementItem[] = [
      { page: 1, y: 400, x: 300, text: "right" },
      { page: 1, y: 400, x: 48, text: "left" },
      { page: 1, y: 400, x: 160, text: "middle" },
    ];

    const lines = groupStatementLines(items);

    expect(lines).toHaveLength(1);
    expect(lines[0].page).toBe(1);
    expect(lines[0].y).toBe(400);
    expect(lines[0].items.map((item) => item.text)).toEqual([
      "left",
      "middle",
      "right",
    ]);
  });

  it("keeps items with the same y on different pages apart", () => {
    const items: StatementItem[] = [
      { page: 1, y: 400, x: 48, text: "page one" },
      { page: 2, y: 400, x: 48, text: "page two" },
    ];

    expect(groupStatementLines(items)).toHaveLength(2);
  });
});

describe("parseNorwegianAmount", () => {
  it("reads thousands separators and a decimal comma", () => {
    expect(parseNorwegianAmount("57.514,86")).toBe(57514.86);
  });

  it("keeps a leading minus sign", () => {
    expect(parseNorwegianAmount("-1.234,56")).toBe(-1234.56);
  });

  it("reads an amount below a thousand", () => {
    expect(parseNorwegianAmount("628,72")).toBe(628.72);
  });
});

describe("toBookingDate", () => {
  it("expands a two-digit year in the previous calendar year", () => {
    expect(toBookingDate("16.12.25")).toBe("16.12.2025");
  });

  it("expands a two-digit year in the current calendar year", () => {
    expect(toBookingDate("06.01.26")).toBe("06.01.2026");
  });
});

describe("labelledAmount", () => {
  const items: StatementItem[] = [
    { page: 1, y: 300, x: 20, text: "Ny saldo" },
    { page: 1, y: 300, x: 200, text: "1.000,00" },
    { page: 1, y: 300, x: 400, text: "28.371,81" },
    { page: 1, y: 200, x: 20, text: "Saldo forrige periode" },
    { page: 1, y: 200, x: 10, text: "-999,99" },
  ];

  it("takes the rightmost amount to the right of the label", () => {
    expect(labelledAmount(groupStatementLines(items), "Ny saldo")).toBe(
      28371.81,
    );
  });

  it("ignores amounts printed to the left of the label", () => {
    expect(
      labelledAmount(groupStatementLines(items), "Saldo forrige periode"),
    ).toBeNull();
  });

  it("returns null when the label is absent", () => {
    expect(
      labelledAmount(groupStatementLines(items), "Nytt skyldig beløp"),
    ).toBeNull();
  });
});

describe("statementDriftNok", () => {
  it("is zero when the movement walks opening to closing", () => {
    expect(
      statementDriftNok({
        openingNok: 20000,
        movementNok: 8371.81,
        closingNok: 28371.81,
      }),
    ).toBe(0);
  });

  it("reports the shortfall when a transaction is missing", () => {
    expect(
      statementDriftNok({
        openingNok: 20000,
        movementNok: 7743.09,
        closingNok: 28371.81,
      }),
    ).toBe(-628.72);
  });
});

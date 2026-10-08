import { describe, expect, it } from "vitest";
import {
  type ColumnMapping,
  columnMappingFitsHeaders,
  completeColumnMapping,
  parseColumnMapping,
  toCsvHeaderSignature,
} from "./column-mapping";

const DNB_MAPPING: ColumnMapping = {
  date: { index: 0, header: "Dato" },
  amount: {
    kind: "split",
    inflow: { index: 4, header: "Inn på konto" },
    outflow: { index: 3, header: "Ut fra konto" },
  },
  description: [{ index: 1, header: "Forklaring" }],
};

describe("parseColumnMapping", () => {
  it("accepts a split-amount mapping and returns it unchanged", () => {
    expect(parseColumnMapping(DNB_MAPPING)).toEqual(DNB_MAPPING);
  });

  it("accepts a signed-amount mapping with a payment type", () => {
    const mapping = {
      date: { index: 0, header: "Bokføringsdato" },
      amount: { kind: "signed", column: { index: 1, header: "Beløp" } },
      description: [
        { index: 4, header: "Navn" },
        { index: 5, header: "Tittel" },
      ],
      paymentType: { index: 7, header: "Betalingstype" },
    };

    expect(parseColumnMapping(mapping)).toEqual(mapping);
  });

  it("rejects an empty description list", () => {
    expect(parseColumnMapping({ ...DNB_MAPPING, description: [] })).toBeNull();
  });

  it("rejects a negative or fractional column index", () => {
    expect(
      parseColumnMapping({
        ...DNB_MAPPING,
        date: { index: -1, header: "Dato" },
      }),
    ).toBeNull();
    expect(
      parseColumnMapping({
        ...DNB_MAPPING,
        date: { index: 0.5, header: "Dato" },
      }),
    ).toBeNull();
  });

  it("rejects an unknown amount kind", () => {
    expect(
      parseColumnMapping({
        ...DNB_MAPPING,
        amount: { kind: "debitCredit", column: { index: 3, header: "Ut" } },
      }),
    ).toBeNull();
  });

  it("rejects a split amount missing its outflow column", () => {
    expect(
      parseColumnMapping({
        ...DNB_MAPPING,
        amount: { kind: "split", inflow: { index: 4, header: "Inn på konto" } },
      }),
    ).toBeNull();
  });

  it("rejects values that are not a mapping at all", () => {
    expect(parseColumnMapping(null)).toBeNull();
    expect(parseColumnMapping("Dato")).toBeNull();
    expect(parseColumnMapping({})).toBeNull();
  });
});

describe("toCsvHeaderSignature", () => {
  it("joins normalized headers so case and Nordic letters do not matter", () => {
    expect(
      toCsvHeaderSignature([
        "Dato",
        "Forklaring",
        "Ut fra konto",
        "Inn på konto",
      ]),
    ).toBe("dato|forklaring|utfrakonto|innpakonto");
    expect(toCsvHeaderSignature(["DATO", " Beløp "])).toBe("dato|belop");
  });
});

describe("columnMappingFitsHeaders", () => {
  const headers = [
    "Dato",
    "Forklaring",
    "Rentedato",
    "Ut fra konto",
    "Inn på konto",
  ];

  it("fits when every referenced column sits at its index under its header", () => {
    expect(columnMappingFitsHeaders(DNB_MAPPING, headers)).toBe(true);
  });

  it("does not fit when a referenced column moved", () => {
    expect(
      columnMappingFitsHeaders(DNB_MAPPING, [
        "Dato",
        "Forklaring",
        "Rentedato",
        "Inn på konto",
        "Ut fra konto",
      ]),
    ).toBe(false);
  });

  it("does not fit when a referenced index is past the last column", () => {
    expect(columnMappingFitsHeaders(DNB_MAPPING, headers.slice(0, 4))).toBe(
      false,
    );
  });
});

describe("completeColumnMapping", () => {
  it("returns null while date, amount or description is missing", () => {
    expect(
      completeColumnMapping({
        date: DNB_MAPPING.date,
        amount: null,
        description: DNB_MAPPING.description,
        paymentType: null,
      }),
    ).toBeNull();
    expect(
      completeColumnMapping({
        date: DNB_MAPPING.date,
        amount: DNB_MAPPING.amount,
        description: [],
        paymentType: null,
      }),
    ).toBeNull();
  });

  it("drops an unset payment type instead of storing null", () => {
    expect(
      completeColumnMapping({
        date: DNB_MAPPING.date,
        amount: DNB_MAPPING.amount,
        description: DNB_MAPPING.description,
        paymentType: null,
      }),
    ).toEqual(DNB_MAPPING);
  });
});

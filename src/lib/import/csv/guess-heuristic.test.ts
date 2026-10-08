import { describe, expect, it } from "vitest";
import { guessColumnMappingHeuristically } from "./guess-heuristic";

describe("guessColumnMappingHeuristically", () => {
  it("maps the Nordea / built-in Norwegian export by header name", () => {
    const guess = guessColumnMappingHeuristically(
      [
        "Bokføringsdato",
        "Beløp",
        "Avsender",
        "Mottaker",
        "Navn",
        "Tittel",
        "Valuta",
        "Betalingstype",
      ],
      [
        [
          "01.01.2026",
          "-1 234,56",
          "Alice",
          "Shop",
          "Rema 1000",
          "Varekjøp",
          "NOK",
          "Kort",
        ],
      ],
    );

    expect(guess).toEqual({
      date: { index: 0, header: "Bokføringsdato" },
      amount: { kind: "signed", column: { index: 1, header: "Beløp" } },
      description: [
        { index: 4, header: "Navn" },
        { index: 5, header: "Tittel" },
      ],
      paymentType: { index: 7, header: "Betalingstype" },
    });
  });

  it("maps the SpareBank 1 export by header name", () => {
    const guess = guessColumnMappingHeuristically(
      ["Dato", "Beløp", "Avsender", "Mottaker", "Beskrivelse"],
      [["15.01.2026", "-89,00", "", "Vy", "VY TOG OSLO S"]],
    );

    expect(guess).toEqual({
      date: { index: 0, header: "Dato" },
      amount: { kind: "signed", column: { index: 1, header: "Beløp" } },
      description: [{ index: 4, header: "Beskrivelse" }],
      paymentType: null,
    });
  });

  it("maps DNB's separate out and in columns to a split amount", () => {
    const guess = guessColumnMappingHeuristically(
      ["Dato", "Forklaring", "Rentedato", "Ut fra konto", "Inn på konto"],
      [
        ["02.01.2026", "Kiwi Majorstuen", "02.01.2026", "249,90", ""],
        ["03.01.2026", "Lønn", "03.01.2026", "", "35 000,00"],
      ],
    );

    expect(guess).toEqual({
      date: { index: 0, header: "Dato" },
      amount: {
        kind: "split",
        inflow: { index: 4, header: "Inn på konto" },
        outflow: { index: 3, header: "Ut fra konto" },
      },
      description: [{ index: 1, header: "Forklaring" }],
      paymentType: null,
    });
  });

  it("falls back to the sample values when no header is recognized", () => {
    const guess = guessColumnMappingHeuristically(
      ["Booked", "Reference", "Sum NOK", "Merchant text"],
      [
        ["2026-02-01", "A1", "-312.50", "REMA 1000 GRUNERLOKKA"],
        ["2026-02-02", "B2", "-89.00", "VY TOG"],
      ],
    );

    expect(guess).toEqual({
      date: { index: 0, header: "Booked" },
      amount: { kind: "signed", column: { index: 2, header: "Sum NOK" } },
      description: [{ index: 3, header: "Merchant text" }],
      paymentType: null,
    });
  });

  it("leaves fields empty when neither headers nor samples settle them", () => {
    expect(guessColumnMappingHeuristically(["A", "B"], [])).toEqual({
      date: null,
      amount: null,
      description: [],
      paymentType: null,
    });
  });
});

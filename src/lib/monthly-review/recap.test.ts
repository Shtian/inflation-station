import { describe, expect, it } from "vitest";
import { toMonthlyRecap } from "./recap";

describe("toMonthlyRecap", () => {
  it("trims the headline and drops blank points", () => {
    expect(
      toMonthlyRecap({
        headline: "  Mars endte i pluss med 12 500 kr. ",
        points: [" Mat gikk ned. ", "   ", "", "Prøv en ukesmeny."],
      }),
    ).toEqual({
      headline: "Mars endte i pluss med 12 500 kr.",
      points: ["Mat gikk ned.", "Prøv en ukesmeny."],
    });
  });

  it("returns null when the headline is blank", () => {
    expect(toMonthlyRecap({ headline: "  ", points: ["Mat gikk ned."] })).toBe(
      null,
    );
  });

  it("returns null for values that are not a recap", () => {
    expect(toMonthlyRecap(null)).toBeNull();
    expect(toMonthlyRecap("Mars endte i pluss.")).toBeNull();
    expect(toMonthlyRecap({ headline: "Mars endte i pluss." })).toBeNull();
  });
});

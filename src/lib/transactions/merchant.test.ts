import { describe, expect, it } from "vitest";
import { normalizeMerchantKey, toMerchantColumns } from "./merchant";

describe("normalizeMerchantKey", () => {
  it.each([
    ["Bær & Øl Åsen AS", "baer ol asen as"],
    ["  Corner   Shop ", "corner shop"],
    ["SUSHI & WOK GRÜNERLØKKA", "sushi wok gr nerlokka"],
    ["&&", ""],
    ["Coffee & Tea", "coffee tea"],
  ])("folds %j to %j", (input, expected) => {
    expect(normalizeMerchantKey(input)).toBe(expected);
  });
});

describe("toMerchantColumns", () => {
  it("keeps the display merchant and derives the key", () => {
    expect(toMerchantColumns("Bær & Øl Åsen AS")).toEqual({
      merchant: "Bær & Øl Åsen AS",
      normalizedMerchant: "baer ol asen as",
    });
  });
});

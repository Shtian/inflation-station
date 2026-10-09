import { describe, expect, it } from "vitest";
import { suggestCategoriesFromHistory } from "./history-suggestions";

describe("suggestCategoriesFromHistory", () => {
  it.each([
    ["kiwi 0445 stovner", "kiwi 0312 majorstuen", true],
    ["rema 1000 5062 oslo no", "rema 1000 1234 bergen", true],
    ["meny sogn oslo", "meny grunerlokka", true],
    ["apple com bill", "apple store oslo", false],
    ["ruter as nettbutikk", "ruter as automat", true],
    ["kiwi 0445 stovner", "vipps kiwi", true],
    ["vipps joker majorstuen", "vipps kiwi", false],
    ["paypal netflix", "paypal spotify", false],
    ["rema 1000 5062 oslo no", "visa 123456 rema 1000 oslo", true],
    ["vipps", "vipps 99887766", false],
  ])("history %s against row %s matches: %s", (previous, next, shouldMatch) => {
    const suggestions = suggestCategoriesFromHistory(
      [{ rowNumber: 2, normalizedMerchant: next }],
      [{ normalizedMerchant: previous, categoryId: "cat-a" }],
    );

    expect(suggestions).toEqual(
      shouldMatch ? [{ rowNumber: 2, categoryId: "cat-a", confidence: 1 }] : [],
    );
  });

  it("suggests the majority category with its share as confidence", () => {
    const suggestions = suggestCategoriesFromHistory(
      [{ rowNumber: 2, normalizedMerchant: "circle k 1234 oslo" }],
      [
        { normalizedMerchant: "circle k 1234 oslo", categoryId: "cat-fuel" },
        { normalizedMerchant: "circle k 1234 oslo", categoryId: "cat-fuel" },
        { normalizedMerchant: "circle k 1234 oslo", categoryId: "cat-fuel" },
        { normalizedMerchant: "circle k 1234 oslo", categoryId: "cat-snacks" },
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-fuel", confidence: 0.75 },
    ]);
  });

  it("suggests nothing when no category holds more than half of the matches", () => {
    const suggestions = suggestCategoriesFromHistory(
      [
        { rowNumber: 2, normalizedMerchant: "circle k 1234 oslo" },
        { rowNumber: 3, normalizedMerchant: "kiwi 0445 stovner" },
      ],
      [
        { normalizedMerchant: "circle k 1234 oslo", categoryId: "cat-fuel" },
        { normalizedMerchant: "circle k 1234 oslo", categoryId: "cat-snacks" },
        {
          normalizedMerchant: "kiwi 0445 stovner",
          categoryId: "cat-groceries",
        },
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 3, categoryId: "cat-groceries", confidence: 1 },
    ]);
  });

  it("prefers an exact merchant match over the merchant family", () => {
    const suggestions = suggestCategoriesFromHistory(
      [
        { rowNumber: 2, normalizedMerchant: "kiwi 0445 stovner" },
        { rowNumber: 3, normalizedMerchant: "kiwi 0999 bryn" },
      ],
      [
        {
          normalizedMerchant: "kiwi 0445 stovner",
          categoryId: "cat-household",
        },
        {
          normalizedMerchant: "kiwi 0312 majorstuen",
          categoryId: "cat-groceries",
        },
        {
          normalizedMerchant: "kiwi 0312 majorstuen",
          categoryId: "cat-groceries",
        },
        {
          normalizedMerchant: "kiwi 0100 sentrum",
          categoryId: "cat-groceries",
        },
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-household", confidence: 1 },
      { rowNumber: 3, categoryId: "cat-groceries", confidence: 0.75 },
    ]);
  });

  it("lets a split exact merchant fall through instead of using the family", () => {
    const suggestions = suggestCategoriesFromHistory(
      [
        { rowNumber: 2, normalizedMerchant: "circle k 1234 oslo" },
        { rowNumber: 3, normalizedMerchant: "circle k 4444 lier" },
      ],
      [
        { normalizedMerchant: "circle k 1234 oslo", categoryId: "cat-fuel" },
        { normalizedMerchant: "circle k 1234 oslo", categoryId: "cat-snacks" },
        { normalizedMerchant: "circle k 9876 bergen", categoryId: "cat-fuel" },
        { normalizedMerchant: "circle k 5555 moss", categoryId: "cat-fuel" },
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 3, categoryId: "cat-fuel", confidence: 0.75 },
    ]);
  });

  it("ignores store numbers and dates before the brand", () => {
    const suggestions = suggestCategoriesFromHistory(
      [{ rowNumber: 2, normalizedMerchant: "12 03 7 eleven 221 oslo s" }],
      [{ normalizedMerchant: "7 eleven 108 bergen", categoryId: "cat-snacks" }],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-snacks", confidence: 1 },
    ]);
  });
});

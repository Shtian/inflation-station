import { describe, expect, it } from "vitest";
import {
  type CategorizedHistoryEntry,
  type HistoryLookupRow,
  suggestCategoriesFromHistory,
} from "./history-suggestions";

function row(
  rowNumber: number,
  normalizedMerchant: string,
  amountNok = -100,
): HistoryLookupRow {
  return { rowNumber, normalizedMerchant, amountNok };
}

function past(
  normalizedMerchant: string,
  categoryId: string,
  amountNok = -100,
): CategorizedHistoryEntry {
  return { normalizedMerchant, categoryId, amountNok };
}

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
    ["h m 0512 storo", "h m 0144 sandvika", false],
    ["kaffebrenneriet 12 oslo", "iz kaffebrenneriet", true],
  ])("two past %s against row %s matches: %s", (previous, next, shouldMatch) => {
    const suggestions = suggestCategoriesFromHistory(
      [row(2, next)],
      [past(previous, "cat-a"), past(previous, "cat-a")],
    );

    expect(suggestions).toEqual(
      shouldMatch ? [{ rowNumber: 2, categoryId: "cat-a", confidence: 1 }] : [],
    );
  });

  it("never lets income history suggest for an expense", () => {
    const suggestions = suggestCategoriesFromHistory(
      [row(2, "norsk tipping", -200), row(3, "norsk arbeidsgiver as", 45000)],
      [
        past("norsk arbeidsgiver as", "cat-salary", 45000),
        past("norsk arbeidsgiver as", "cat-salary", 45000),
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 3, categoryId: "cat-salary", confidence: 1 },
    ]);
  });

  it("needs two past transactions behind a family match but one behind an exact match", () => {
    const suggestions = suggestCategoriesFromHistory(
      [
        row(2, "meny grunerlokka"),
        row(3, "kiwi 0312 majorstuen"),
        row(4, "kiwi 0445 stovner"),
      ],
      [
        past("meny sogn oslo", "cat-groceries"),
        past("kiwi 0445 stovner", "cat-groceries"),
        past("kiwi 0100 sentrum", "cat-groceries"),
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 3, categoryId: "cat-groceries", confidence: 1 },
      { rowNumber: 4, categoryId: "cat-groceries", confidence: 1 },
    ]);
  });

  it("suggests the majority category with its share as confidence", () => {
    const suggestions = suggestCategoriesFromHistory(
      [row(2, "circle k 1234 oslo")],
      [
        past("circle k 1234 oslo", "cat-fuel"),
        past("circle k 1234 oslo", "cat-fuel"),
        past("circle k 1234 oslo", "cat-fuel"),
        past("circle k 1234 oslo", "cat-snacks"),
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-fuel", confidence: 0.75 },
    ]);
  });

  it("suggests nothing when no category holds more than half of the matches", () => {
    const suggestions = suggestCategoriesFromHistory(
      [row(2, "circle k 1234 oslo"), row(3, "kiwi 0445 stovner")],
      [
        past("circle k 1234 oslo", "cat-fuel"),
        past("circle k 1234 oslo", "cat-snacks"),
        past("kiwi 0445 stovner", "cat-groceries"),
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 3, categoryId: "cat-groceries", confidence: 1 },
    ]);
  });

  it("prefers an exact merchant match over the merchant family", () => {
    const suggestions = suggestCategoriesFromHistory(
      [row(2, "kiwi 0445 stovner"), row(3, "kiwi 0999 bryn")],
      [
        past("kiwi 0445 stovner", "cat-household"),
        past("kiwi 0312 majorstuen", "cat-groceries"),
        past("kiwi 0312 majorstuen", "cat-groceries"),
        past("kiwi 0100 sentrum", "cat-groceries"),
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-household", confidence: 1 },
      { rowNumber: 3, categoryId: "cat-groceries", confidence: 0.75 },
    ]);
  });

  it("lets a split exact merchant fall through instead of using the family", () => {
    const suggestions = suggestCategoriesFromHistory(
      [row(2, "circle k 1234 oslo"), row(3, "circle k 4444 lier")],
      [
        past("circle k 1234 oslo", "cat-fuel"),
        past("circle k 1234 oslo", "cat-snacks"),
        past("circle k 9876 bergen", "cat-fuel"),
        past("circle k 5555 moss", "cat-fuel"),
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 3, categoryId: "cat-fuel", confidence: 0.75 },
    ]);
  });

  it("ignores store numbers and dates before the brand", () => {
    const suggestions = suggestCategoriesFromHistory(
      [row(2, "12 03 7 eleven 221 oslo s")],
      [
        past("7 eleven 108 bergen", "cat-snacks"),
        past("7 eleven 940 moss", "cat-snacks"),
      ],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-snacks", confidence: 1 },
    ]);
  });
});

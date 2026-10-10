import { describe, expect, it } from "vitest";
import {
  applyMerchantChip,
  formatJevCategoryLine,
  merchantPresence,
  namesAnyMerchant,
  splitHint,
  suggestHintText,
} from "./hint-text";

const rema = { key: "rema", label: "Rema" };
const kiwi = { key: "kiwi", label: "Kiwi" };
const bolt = { key: "bolt", label: "Bolt" };
const uber = { key: "uber", label: "Uber" };
const ruter = { key: "ruter", label: "Ruter" };

describe("splitHint", () => {
  it("does not split on commas inside parentheses", () => {
    expect(
      splitHint("Bolt (not Bolt Food, not Wolt), taxi").map((s) => s.raw),
    ).toEqual(["Bolt (not Bolt Food, not Wolt)", "taxi"]);
  });

  it("starts a new item after a sentence terminator and keeps offsets into the text", () => {
    expect(splitHint("Groceries: Rema 1000,  Kiwi")).toEqual([
      { start: 0, end: 9, raw: "Groceries" },
      { start: 11, end: 20, raw: "Rema 1000" },
      { start: 23, end: 27, raw: "Kiwi" },
    ]);
  });
});

describe("merchantPresence", () => {
  it.each([
    ["Rema 1000, Kiwi", rema, "on"],
    ["Groceries: Rema 1000, Kiwi", rema, "on"],
    ["Ruter, Vy, Bolt (not Bolt Food), taxi", bolt, "mentioned"],
    ["Kiwiland", kiwi, "off"],
    ["grønland bakeri", { key: "gronland", label: "Grønland Bakeri" }, "on"],
    [
      "Norsk Arbeidsgiver AS",
      { key: "norsk", label: "Norsk Arbeidsgiver" },
      "on",
    ],
  ] as const)("%j with %j is %s", (text, merchant, presence) => {
    expect(merchantPresence(text, merchant)).toBe(presence);
  });
});

describe("applyMerchantChip", () => {
  it("appends a merchant that is off and removes it again", () => {
    const added = applyMerchantChip("Ruter, Vy", uber);
    expect(added).toEqual({ kind: "text", text: "Ruter, Vy, Uber" });
    expect(applyMerchantChip("Ruter, Vy, Uber", uber)).toEqual({
      kind: "text",
      text: "Ruter, Vy",
    });
  });

  it("starts an empty hint with the label", () => {
    expect(applyMerchantChip(" ,", uber)).toEqual({
      kind: "text",
      text: "Uber",
    });
  });

  it("removes every on segment including hand-typed duplicates", () => {
    expect(applyMerchantChip("Kiwi, Rema, kiwi", kiwi)).toEqual({
      kind: "text",
      text: "Rema",
    });
  });

  it("leaves every other byte of the user's wording untouched", () => {
    expect(
      applyMerchantChip("Bolt (not Bolt Food),  taxi , Ruter", ruter),
    ).toEqual({ kind: "text", text: "Bolt (not Bolt Food),  taxi" });
  });

  it("appends after a sentence end and removes back to it", () => {
    expect(applyMerchantChip("Groceries.", kiwi)).toEqual({
      kind: "text",
      text: "Groceries. Kiwi",
    });
    expect(applyMerchantChip("Groceries. Kiwi", kiwi)).toEqual({
      kind: "text",
      text: "Groceries.",
    });
  });

  it("removes a list item after a lead sentence with its following comma", () => {
    expect(applyMerchantChip("Groceries: Rema 1000, Kiwi", rema)).toEqual({
      kind: "text",
      text: "Groceries: Kiwi",
    });
  });

  it("returns a note for a merchant inside the user's own wording", () => {
    expect(
      applyMerchantChip("Ruter, Vy, Bolt (not Bolt Food), taxi", bolt),
    ).toEqual({
      kind: "note",
      message:
        "“Bolt” is part of your own wording. Edit the text to change it.",
    });
  });
});

describe("namesAnyMerchant", () => {
  it("is true when a merchant is on or mentioned and false otherwise", () => {
    expect(namesAnyMerchant("Bolt (not Bolt Food)", [kiwi, bolt])).toBe(true);
    expect(namesAnyMerchant("Taxi and trains", [kiwi, bolt])).toBe(false);
  });
});

describe("suggestHintText", () => {
  it("joins the six most used labels", () => {
    const labels = [
      "Kiwi",
      "Rema",
      "Meny",
      "Coop",
      "Joker",
      "Bunnpris",
      "Spar",
    ];
    expect(
      suggestHintText(labels.map((label) => ({ key: label, label }))),
    ).toBe("Kiwi, Rema, Meny, Coop, Joker, Bunnpris");
  });
});

describe("formatJevCategoryLine", () => {
  it("joins name and hint", () => {
    expect(formatJevCategoryLine("Groceries", "Rema 1000, Kiwi")).toBe(
      "Groceries: Rema 1000, Kiwi",
    );
  });

  it("uses the bare name without a hint", () => {
    expect(formatJevCategoryLine("Groceries", null)).toBe("Groceries");
    expect(formatJevCategoryLine("Groceries", "")).toBe("Groceries");
  });
});

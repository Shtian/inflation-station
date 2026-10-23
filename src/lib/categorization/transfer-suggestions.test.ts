import { describe, expect, it } from "vite-plus/test";
import { suggestTransferCategories } from "./transfer-suggestions";

function day(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

describe("suggestTransferCategories", () => {
  it("matches an opposite amount in another account up to three days apart", () => {
    const suggestions = suggestTransferCategories(
      [
        { rowNumber: 2, amountNok: 500, bookingDate: day("2026-01-04") },
        { rowNumber: 3, amountNok: 250.5, bookingDate: day("2026-01-05") },
      ],
      [
        {
          amountNok: -500,
          bookingDate: day("2026-01-01"),
          categoryId: "cat-transfer",
        },
        {
          amountNok: -250.5,
          bookingDate: day("2026-01-01"),
          categoryId: "cat-transfer",
        },
      ],
      ["cat-transfer"],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-transfer", confidence: 0.9 },
    ]);
  });

  it("does not match an amount with the same sign", () => {
    const suggestions = suggestTransferCategories(
      [
        { rowNumber: 2, amountNok: -500, bookingDate: day("2026-01-02") },
        { rowNumber: 3, amountNok: 500, bookingDate: day("2026-01-02") },
      ],
      [
        {
          amountNok: -500,
          bookingDate: day("2026-01-02"),
          categoryId: "cat-transfer",
        },
      ],
      ["cat-transfer"],
    );

    expect(suggestions).toEqual([
      { rowNumber: 3, categoryId: "cat-transfer", confidence: 0.9 },
    ]);
  });

  it("skips a candidate filed under a non-transfer category and falls back to the sole transfer category", () => {
    const suggestions = suggestTransferCategories(
      [{ rowNumber: 2, amountNok: 500, bookingDate: day("2026-01-02") }],
      [
        {
          amountNok: -500,
          bookingDate: day("2026-01-02"),
          categoryId: "cat-groceries",
        },
        {
          amountNok: -500,
          bookingDate: day("2026-01-04"),
          categoryId: null,
        },
      ],
      ["cat-transfer"],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-transfer", confidence: 0.9 },
    ]);
  });

  it("uses each candidate once, so the second identical row stays unmatched", () => {
    const suggestions = suggestTransferCategories(
      [
        { rowNumber: 3, amountNok: 500, bookingDate: day("2026-01-02") },
        { rowNumber: 2, amountNok: 500, bookingDate: day("2026-01-02") },
      ],
      [
        {
          amountNok: -500,
          bookingDate: day("2026-01-02"),
          categoryId: "cat-transfer",
        },
      ],
      ["cat-transfer"],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-transfer", confidence: 0.9 },
    ]);
  });

  it("pairs each row with its closest-date candidate, earliest on a tie", () => {
    const suggestions = suggestTransferCategories(
      [
        { rowNumber: 2, amountNok: 500, bookingDate: day("2026-01-05") },
        { rowNumber: 3, amountNok: 500, bookingDate: day("2026-01-05") },
      ],
      [
        {
          amountNok: -500,
          bookingDate: day("2026-01-06"),
          categoryId: "cat-after",
        },
        {
          amountNok: -500,
          bookingDate: day("2026-01-04"),
          categoryId: "cat-before",
        },
      ],
      ["cat-after", "cat-before"],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-before", confidence: 0.9 },
      { rowNumber: 3, categoryId: "cat-after", confidence: 0.9 },
    ]);
  });

  it("uses the candidate's own transfer category when several exist", () => {
    const suggestions = suggestTransferCategories(
      [{ rowNumber: 2, amountNok: -1200, bookingDate: day("2026-01-02") }],
      [
        {
          amountNok: 1200,
          bookingDate: day("2026-01-02"),
          categoryId: "cat-savings-transfer",
        },
      ],
      ["cat-transfer", "cat-savings-transfer"],
    );

    expect(suggestions).toEqual([
      { rowNumber: 2, categoryId: "cat-savings-transfer", confidence: 0.9 },
    ]);
  });

  it("suggests nothing for an uncategorized candidate when no sole transfer category exists", () => {
    const suggestions = suggestTransferCategories(
      [
        { rowNumber: 2, amountNok: 500, bookingDate: day("2026-01-02") },
        { rowNumber: 3, amountNok: 700, bookingDate: day("2026-01-02") },
      ],
      [
        { amountNok: -500, bookingDate: day("2026-01-02"), categoryId: null },
        {
          amountNok: -700,
          bookingDate: day("2026-01-02"),
          categoryId: "cat-transfer",
        },
      ],
      ["cat-transfer", "cat-savings-transfer"],
    );

    expect(suggestions).toEqual([
      { rowNumber: 3, categoryId: "cat-transfer", confidence: 0.9 },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  applyProviderTransforms,
  parseProviderAmount,
  parseProviderBookingDate,
} from "./values";

describe("parseProviderBookingDate", () => {
  it("parses a value matching the declared ISO format", () => {
    expect(parseProviderBookingDate("2026-02-28", "YYYY-MM-DD")).toBe(
      "2026-02-28",
    );
  });

  it("parses a value matching the declared Norwegian format", () => {
    expect(parseProviderBookingDate("15.01.2026", "DD.MM.YYYY")).toBe(
      "2026-01-15",
    );
  });

  it("trims surrounding whitespace before matching the declared format", () => {
    expect(parseProviderBookingDate("  15.01.2026  ", "DD.MM.YYYY")).toBe(
      "2026-01-15",
    );
  });

  it("rejects a value in the other supported format instead of reinterpreting day/month (format mismatch is an error, not a fallback)", () => {
    expect(parseProviderBookingDate("15.01.2026", "YYYY-MM-DD")).toBeNull();
    expect(parseProviderBookingDate("2026-01-15", "DD.MM.YYYY")).toBeNull();
  });

  it("rejects a calendar-invalid Norwegian date", () => {
    expect(parseProviderBookingDate("32.01.2026", "DD.MM.YYYY")).toBeNull();
    expect(parseProviderBookingDate("29.02.2026", "DD.MM.YYYY")).toBeNull();
  });

  it("rejects a calendar-invalid ISO date", () => {
    expect(parseProviderBookingDate("2026-02-30", "YYYY-MM-DD")).toBeNull();
    expect(parseProviderBookingDate("2023-02-29", "YYYY-MM-DD")).toBeNull();
  });

  it("accepts a leap-day date in either format", () => {
    expect(parseProviderBookingDate("29.02.2024", "DD.MM.YYYY")).toBe(
      "2024-02-29",
    );
    expect(parseProviderBookingDate("2024-02-29", "YYYY-MM-DD")).toBe(
      "2024-02-29",
    );
  });

  it("rejects garbage input", () => {
    expect(parseProviderBookingDate("not a date", "DD.MM.YYYY")).toBeNull();
    expect(parseProviderBookingDate("", "YYYY-MM-DD")).toBeNull();
  });
});

describe("parseProviderAmount", () => {
  it("parses a comma-decimal amount with no thousands separator", () => {
    expect(parseProviderAmount("1234,56", ",")).toBe(1234.56);
  });

  it("parses a comma-decimal amount with period thousands separators", () => {
    expect(parseProviderAmount("12.345,67", ",")).toBe(12345.67);
    expect(parseProviderAmount("1.234.567,89", ",")).toBe(1234567.89);
  });

  it("parses a comma-decimal amount with whitespace thousands separators, including NBSP and thin space", () => {
    expect(parseProviderAmount("12 345,67", ",")).toBe(12345.67);
    expect(parseProviderAmount("12\u00A0345,67", ",")).toBe(12345.67);
    expect(parseProviderAmount("12\u2009345,67", ",")).toBe(12345.67);
  });

  it("parses a period-decimal amount with no thousands separator", () => {
    expect(parseProviderAmount("1234.56", ".")).toBe(1234.56);
  });

  it("parses a period-decimal amount with comma thousands separators", () => {
    expect(parseProviderAmount("1,234.56", ".")).toBe(1234.56);
    expect(parseProviderAmount("1,234,567.89", ".")).toBe(1234567.89);
  });

  it("handles a leading minus sign", () => {
    expect(parseProviderAmount("-1234,56", ",")).toBe(-1234.56);
  });

  it("handles a leading plus sign", () => {
    expect(parseProviderAmount("+1234,56", ",")).toBe(1234.56);
  });

  it("handles a trailing minus sign (Nordic export convention)", () => {
    expect(parseProviderAmount("1234,56-", ",")).toBe(-1234.56);
  });

  it("rejects a value with both a leading and trailing sign", () => {
    expect(parseProviderAmount("-1234,56-", ",")).toBeNull();
    expect(parseProviderAmount("+1234,56-", ",")).toBeNull();
  });

  it("rejects a malformed thousands grouping instead of guessing", () => {
    expect(parseProviderAmount("12.34,56", ",")).toBeNull();
    expect(parseProviderAmount(".234,56", ",")).toBeNull();
  });

  it("rejects more than one decimal separator", () => {
    expect(parseProviderAmount("12,34,56", ",")).toBeNull();
  });

  it("rejects a non-digit fraction", () => {
    expect(parseProviderAmount("1234,5a", ",")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseProviderAmount("abc", ",")).toBeNull();
  });

  it("rejects empty or blank input", () => {
    expect(parseProviderAmount("", ",")).toBeNull();
    expect(parseProviderAmount("   ", ",")).toBeNull();
  });
});

describe("applyProviderTransforms", () => {
  it("returns the value unchanged when there are no transforms", () => {
    expect(applyProviderTransforms("  Hello  ", [])).toBe("  Hello  ");
  });

  it("trims surrounding whitespace", () => {
    expect(applyProviderTransforms("  hello  ", [{ type: "trim" }])).toBe(
      "hello",
    );
  });

  it("uppercases the value", () => {
    expect(applyProviderTransforms("hello", [{ type: "uppercase" }])).toBe(
      "HELLO",
    );
  });

  it("lowercases the value", () => {
    expect(applyProviderTransforms("HELLO", [{ type: "lowercase" }])).toBe(
      "hello",
    );
  });

  describe("mapValues", () => {
    it("matches keys on the trimmed, case-folded value", () => {
      expect(
        applyProviderTransforms("  VAREKJØP  ", [
          { type: "mapValues", values: { varekjøp: "Kort" } },
        ]),
      ).toBe("Kort");
    });

    it("matches when the configured key itself has different case or padding", () => {
      expect(
        applyProviderTransforms("varekjøp", [
          { type: "mapValues", values: { "  Varekjøp  ": "Kort" } },
        ]),
      ).toBe("Kort");
    });

    it("passes the original value through unchanged when there is no match and no fallback", () => {
      expect(
        applyProviderTransforms("Ukjent", [
          { type: "mapValues", values: { varekjøp: "Kort" } },
        ]),
      ).toBe("Ukjent");
    });

    it("returns the configured fallback when there is no match", () => {
      expect(
        applyProviderTransforms("Ukjent", [
          {
            type: "mapValues",
            values: { varekjøp: "Kort" },
            fallback: "Annet",
          },
        ]),
      ).toBe("Annet");
    });
  });

  describe("applySign", () => {
    it("forces a leading minus on an amount-shaped value", () => {
      expect(
        applyProviderTransforms("99,90", [
          { type: "applySign", sign: "negative" },
        ]),
      ).toBe("-99,90");
    });

    it("strips an existing sign when forcing positive", () => {
      expect(
        applyProviderTransforms("-99,90", [
          { type: "applySign", sign: "positive" },
        ]),
      ).toBe("99,90");
      expect(
        applyProviderTransforms("99,90-", [
          { type: "applySign", sign: "positive" },
        ]),
      ).toBe("99,90");
    });

    it("is a plain sign-character operation on non-amount text: it only touches a leading/trailing +/- and otherwise leaves the text untouched", () => {
      expect(
        applyProviderTransforms("ACME", [
          { type: "applySign", sign: "negative" },
        ]),
      ).toBe("-ACME");
      expect(
        applyProviderTransforms("-ACME", [
          { type: "applySign", sign: "positive" },
        ]),
      ).toBe("ACME");
      expect(
        applyProviderTransforms("ACME", [
          { type: "applySign", sign: "positive" },
        ]),
      ).toBe("ACME");
    });
  });

  it("runs transforms in stored order, and reordering changes the result deterministically", () => {
    const transformsThenUppercase = applyProviderTransforms("Varekjøp", [
      { type: "mapValues", values: { varekjøp: "Kort" } },
      { type: "uppercase" },
    ]);
    const uppercaseThenTransforms = applyProviderTransforms("Varekjøp", [
      { type: "uppercase" },
      { type: "mapValues", values: { varekjøp: "Kort" } },
    ]);

    expect(transformsThenUppercase).toBe("KORT");
    expect(uppercaseThenTransforms).toBe("Kort");
    expect(transformsThenUppercase).not.toBe(uppercaseThenTransforms);
  });
});

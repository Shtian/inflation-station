import { describe, expect, it } from "vitest";
import {
  inferDateFormat,
  inferDecimalSeparator,
  parseAmount,
  parseBookingDate,
} from "./values";

describe("parseBookingDate", () => {
  it("parses a value matching the declared ISO format", () => {
    expect(parseBookingDate("2026-02-28", "YYYY-MM-DD")).toBe("2026-02-28");
  });

  it("parses a value matching the declared Norwegian format", () => {
    expect(parseBookingDate("15.01.2026", "DD.MM.YYYY")).toBe("2026-01-15");
  });

  it("parses a value matching the declared slash format", () => {
    expect(parseBookingDate("2026/08/24", "YYYY/MM/DD")).toBe("2026-08-24");
  });

  it("trims surrounding whitespace before matching the declared format", () => {
    expect(parseBookingDate("  15.01.2026  ", "DD.MM.YYYY")).toBe("2026-01-15");
  });

  it("rejects a value in another supported format instead of reinterpreting day/month (format mismatch is an error, not a fallback)", () => {
    expect(parseBookingDate("15.01.2026", "YYYY-MM-DD")).toBeNull();
    expect(parseBookingDate("2026-01-15", "DD.MM.YYYY")).toBeNull();
    expect(parseBookingDate("2026/01/15", "YYYY-MM-DD")).toBeNull();
    expect(parseBookingDate("2026-01-15", "YYYY/MM/DD")).toBeNull();
  });

  it("rejects a calendar-invalid Norwegian date", () => {
    expect(parseBookingDate("32.01.2026", "DD.MM.YYYY")).toBeNull();
    expect(parseBookingDate("29.02.2026", "DD.MM.YYYY")).toBeNull();
  });

  it("rejects a calendar-invalid ISO date", () => {
    expect(parseBookingDate("2026-02-30", "YYYY-MM-DD")).toBeNull();
    expect(parseBookingDate("2023-02-29", "YYYY-MM-DD")).toBeNull();
  });

  it("rejects a calendar-invalid slash date", () => {
    expect(parseBookingDate("2026/02/30", "YYYY/MM/DD")).toBeNull();
    expect(parseBookingDate("2023/02/29", "YYYY/MM/DD")).toBeNull();
  });

  it("accepts a leap-day date in any supported format", () => {
    expect(parseBookingDate("29.02.2024", "DD.MM.YYYY")).toBe("2024-02-29");
    expect(parseBookingDate("2024-02-29", "YYYY-MM-DD")).toBe("2024-02-29");
    expect(parseBookingDate("2024/02/29", "YYYY/MM/DD")).toBe("2024-02-29");
  });

  it("rejects garbage input", () => {
    expect(parseBookingDate("not a date", "DD.MM.YYYY")).toBeNull();
    expect(parseBookingDate("", "YYYY-MM-DD")).toBeNull();
    expect(parseBookingDate("", "YYYY/MM/DD")).toBeNull();
  });
});

describe("parseAmount", () => {
  it("parses a comma-decimal amount with no thousands separator", () => {
    expect(parseAmount("1234,56", ",")).toBe(1234.56);
  });

  it("parses a comma-decimal amount with period thousands separators", () => {
    expect(parseAmount("12.345,67", ",")).toBe(12345.67);
    expect(parseAmount("1.234.567,89", ",")).toBe(1234567.89);
  });

  it("parses a comma-decimal amount with whitespace thousands separators, including NBSP and thin space", () => {
    expect(parseAmount("12 345,67", ",")).toBe(12345.67);
    expect(parseAmount("12\u00A0345,67", ",")).toBe(12345.67);
    expect(parseAmount("12\u2009345,67", ",")).toBe(12345.67);
  });

  it("parses a period-decimal amount with no thousands separator", () => {
    expect(parseAmount("1234.56", ".")).toBe(1234.56);
  });

  it("parses a period-decimal amount with comma thousands separators", () => {
    expect(parseAmount("1,234.56", ".")).toBe(1234.56);
    expect(parseAmount("1,234,567.89", ".")).toBe(1234567.89);
  });

  it("handles a leading minus sign", () => {
    expect(parseAmount("-1234,56", ",")).toBe(-1234.56);
  });

  it("handles a leading plus sign", () => {
    expect(parseAmount("+1234,56", ",")).toBe(1234.56);
  });

  it("handles a trailing minus sign (Nordic export convention)", () => {
    expect(parseAmount("1234,56-", ",")).toBe(-1234.56);
  });

  it("rejects a value with both a leading and trailing sign", () => {
    expect(parseAmount("-1234,56-", ",")).toBeNull();
    expect(parseAmount("+1234,56-", ",")).toBeNull();
  });

  it("rejects a malformed thousands grouping instead of guessing", () => {
    expect(parseAmount("12.34,56", ",")).toBeNull();
    expect(parseAmount(".234,56", ",")).toBeNull();
  });

  it("rejects more than one decimal separator", () => {
    expect(parseAmount("12,34,56", ",")).toBeNull();
  });

  it("rejects a non-digit fraction", () => {
    expect(parseAmount("1234,5a", ",")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseAmount("abc", ",")).toBeNull();
  });

  it("rejects empty or blank input", () => {
    expect(parseAmount("", ",")).toBeNull();
    expect(parseAmount("   ", ",")).toBeNull();
  });
});

describe("parseBookingDate with a two-digit year", () => {
  it("reads DD.MM.YY as a 21st-century date", () => {
    expect(parseBookingDate("05.03.26", "DD.MM.YY")).toBe("2026-03-05");
  });

  it("does not read a four-digit year as DD.MM.YY", () => {
    expect(parseBookingDate("05.03.2026", "DD.MM.YY")).toBeNull();
  });
});

describe("inferDateFormat", () => {
  it("picks the format that parses the most values", () => {
    expect(inferDateFormat(["01.02.2026", "15.02.2026", "Reservert"])).toBe(
      "DD.MM.YYYY",
    );
    expect(inferDateFormat(["2026-02-01", "2026-02-15"])).toBe("YYYY-MM-DD");
  });

  it("returns null when no value is a date", () => {
    expect(inferDateFormat(["Rema 1000", "Kiwi"])).toBeNull();
  });
});

describe("inferDecimalSeparator", () => {
  it("reads Norwegian decimal commas", () => {
    expect(inferDecimalSeparator(["-1 234,56", "99,90"])).toBe(",");
  });

  it("reads period decimals with comma thousands", () => {
    expect(inferDecimalSeparator(["-1,234.56", "99.90"])).toBe(".");
  });

  it("resolves a column of whole numbers to a decimal comma", () => {
    expect(inferDecimalSeparator(["100", "-250"])).toBe(",");
  });
});

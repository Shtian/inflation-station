import { describe, expect, it } from "vitest";
import { getDeterministicColorFromText } from "./deterministic-color";

describe("getDeterministicColorFromText", () => {
  it("returns the same color values for the same text", () => {
    const first = getDeterministicColorFromText("Loan");
    const second = getDeterministicColorFromText("Loan");

    expect(first).toEqual(second);
  });

  it("normalizes whitespace and casing", () => {
    const first = getDeterministicColorFromText("  LOAN  ");
    const second = getDeterministicColorFromText("loan");

    expect(first).toEqual(second);
  });

  it("keeps saturation and lightness fixed inside a variation", () => {
    const loan = getDeterministicColorFromText("Loan");
    const rent = getDeterministicColorFromText("Rent");

    expect(loan.saturation).toBe(rent.saturation);
    expect(loan.lightness).toBe(rent.lightness);
  });

  it("supports typed variations with distinct profiles", () => {
    const vibrant = getDeterministicColorFromText("Loan", "vibrant");
    const muted = getDeterministicColorFromText("Loan", "muted");
    const mattePastel = getDeterministicColorFromText("Loan", "mattePastel");

    expect(vibrant.saturation).toBe(72);
    expect(vibrant.lightness).toBe(46);
    expect(vibrant.backgroundColor).toContain("/ 1)");

    expect(muted.saturation).toBe(52);
    expect(muted.lightness).toBe(52);
    expect(muted.backgroundColor).toContain("/ 1)");

    expect(mattePastel.saturation).toBe(34);
    expect(mattePastel.lightness).toBe(78);
    expect(mattePastel.backgroundColor).toContain("/ 1)");
  });

  it("keeps matte pastel contrast at or above WCAG AA in light and dark", () => {
    const mattePastel = getDeterministicColorFromText("Loan", "mattePastel");

    expect(mattePastel.lightContrastRatio).toBeGreaterThanOrEqual(7);
    expect(mattePastel.darkContrastRatio).toBeGreaterThanOrEqual(7);
  });

  it("solves an explicit light-theme foreground color instead of fixed dark token", () => {
    const mattePastel = getDeterministicColorFromText("Loan", "mattePastel");

    expect(mattePastel.lightTextColor).not.toBe("#111827");
  });
});

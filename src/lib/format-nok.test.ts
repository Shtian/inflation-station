import { describe, expect, it } from "vitest";
import { formatNok, formatSignedNok } from "./format-nok";

describe("formatNok", () => {
  it("keeps øre by default", () => {
    expect(formatNok(25449.5)).toBe("25 449,50 kr");
  });

  it("rounds to whole kroner when asked", () => {
    expect(formatNok(25449.5, { whole: true })).toBe("25 450 kr");
    expect(formatNok(499, { whole: true })).toBe("499 kr");
  });

  it("signs whole kroner from the value", () => {
    expect(formatSignedNok(-3200.4, "auto", { whole: true })).toBe("-3 200 kr");
    expect(formatSignedNok(12500, "auto", { whole: true })).toBe("+12 500 kr");
  });
});

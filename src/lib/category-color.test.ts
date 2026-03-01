import { describe, expect, it } from "vitest";
import { getCategoryColor } from "./category-color";
import { getDeterministicColorFromText } from "./deterministic-color";

describe("getCategoryColor", () => {
  it("returns a fixed neutral color for uncategorized", () => {
    const first = getCategoryColor("Uncategorized");
    const second = getCategoryColor("  uncategorized ");

    expect(first).toEqual(second);
    expect(first.backgroundColor).toBe("oklch(72% 0 0)");
    expect(first.borderColor).toBe("oklch(58% 0 0)");
    expect(first.lightTextColor).toBe("#161616");
    expect(first.darkTextColor).toBe("#f5f5f5");
  });

  it("uses deterministic palette for regular categories", () => {
    const resolved = getCategoryColor("Loan");
    const deterministic = getDeterministicColorFromText("Loan", "muted");

    expect(resolved).toEqual(deterministic);
  });
});

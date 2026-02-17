import { describe, expect, it } from "vitest";
import { getCategoryColor } from "./category-color";
import { getDeterministicColorFromText } from "./deterministic-color";

describe("getCategoryColor", () => {
  it("returns a fixed neutral color for uncategorized", () => {
    const first = getCategoryColor("Uncategorized");
    const second = getCategoryColor("  uncategorized ");

    expect(first).toEqual(second);
    expect(first.backgroundColor).toBe("hsl(0 0% 68%)");
  });

  it("uses deterministic palette for regular categories", () => {
    const resolved = getCategoryColor("Loan", "mattePastel");
    const deterministic = getDeterministicColorFromText("Loan", "mattePastel");

    expect(resolved).toEqual(deterministic);
  });
});

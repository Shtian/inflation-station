import { describe, expect, it } from "vite-plus/test";
import { inferCategoryKind } from "./infer-category-kind";

describe("inferCategoryKind", () => {
  it("treats money out as an expense", () => {
    expect(inferCategoryKind(-250)).toBe("EXPENSE");
  });

  it("treats money in as income", () => {
    expect(inferCategoryKind(1200)).toBe("INCOME");
  });

  it("falls back to expense without a usable amount", () => {
    expect(inferCategoryKind(null)).toBe("EXPENSE");
    expect(inferCategoryKind(0)).toBe("EXPENSE");
    expect(inferCategoryKind(Number.NaN)).toBe("EXPENSE");
  });
});

import { describe, expect, it } from "vitest";
import { hasClassifierHint } from "./categories-manager.utils";

describe("hasClassifierHint", () => {
  it("treats only non-blank hints as present", () => {
    expect(hasClassifierHint({ classifierHint: null })).toBe(false);
    expect(hasClassifierHint({ classifierHint: "" })).toBe(false);
    expect(hasClassifierHint({ classifierHint: "   " })).toBe(false);
    expect(hasClassifierHint({ classifierHint: "Rema 1000" })).toBe(true);
  });
});

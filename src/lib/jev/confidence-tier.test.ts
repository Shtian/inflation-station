import { describe, expect, it } from "vitest";
import { classifyJevConfidence } from "./confidence-tier";

describe("classifyJevConfidence", () => {
  it("returns null just below the floor", () => {
    expect(classifyJevConfidence(0.09)).toBeNull();
  });

  it("returns low at the floor", () => {
    expect(classifyJevConfidence(0.1)).toBe("low");
  });

  it("returns low just below the medium threshold", () => {
    expect(classifyJevConfidence(0.24)).toBe("low");
  });

  it("returns medium at the medium threshold", () => {
    expect(classifyJevConfidence(0.25)).toBe("medium");
  });

  it("returns medium just below the high threshold", () => {
    expect(classifyJevConfidence(0.74)).toBe("medium");
  });

  it("returns high at the high threshold", () => {
    expect(classifyJevConfidence(0.75)).toBe("high");
  });

  it("returns high at the maximum confidence", () => {
    expect(classifyJevConfidence(1.0)).toBe("high");
  });
});

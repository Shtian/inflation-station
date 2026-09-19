import { describe, expect, it } from "vitest";
import { classifyJevConfidence, resolveJevCertainty } from "./confidence-tier";

describe("classifyJevConfidence", () => {
  it("treats confidence below the 0.10 floor as no signal", () => {
    expect(classifyJevConfidence(0.09)).toBeNull();
  });

  it("classifies 0.10 (the floor) as low", () => {
    expect(classifyJevConfidence(0.1)).toBe("low");
  });

  it("classifies 0.24 as low", () => {
    expect(classifyJevConfidence(0.24)).toBe("low");
  });

  it("classifies 0.25 as medium", () => {
    expect(classifyJevConfidence(0.25)).toBe("medium");
  });

  it("classifies 0.74 as medium", () => {
    expect(classifyJevConfidence(0.74)).toBe("medium");
  });

  it("classifies 0.75 as high", () => {
    expect(classifyJevConfidence(0.75)).toBe("high");
  });

  it("classifies 1.0 as high", () => {
    expect(classifyJevConfidence(1.0)).toBe("high");
  });
});

describe("resolveJevCertainty", () => {
  it("returns null for a null confidence", () => {
    expect(resolveJevCertainty(null)).toBeNull();
  });

  it("returns null for a below-floor confidence", () => {
    expect(resolveJevCertainty(0.05)).toBeNull();
  });

  it("bundles the tier with the raw confidence for a valid pick", () => {
    expect(resolveJevCertainty(0.9)).toEqual({ tier: "high", confidence: 0.9 });
  });
});

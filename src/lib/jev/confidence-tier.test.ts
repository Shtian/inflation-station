import { describe, expect, it } from "vitest";
import { classifyJevConfidence } from "./confidence-tier";

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

import { describe, expect, it } from "vitest";
import { applyChunkResult } from "./apply-chunk-result";

describe("applyChunkResult", () => {
  it("writes a cleaned suggestion for rows the provider returned", () => {
    const next = applyChunkResult({}, ["row-1", "row-2"], {
      index: 0,
      status: "ok",
      suggestions: [{ rowId: "row-1", cleanedMessage: "Joker Oslo" }],
    });

    expect(next).toEqual({
      "row-1": { status: "cleaned", text: "Joker Oslo" },
      "row-2": { status: "none" },
    });
  });

  it("marks every row in the chunk unavailable when the chunk failed", () => {
    const next = applyChunkResult(
      { "row-1": { status: "pending" } },
      ["row-1", "row-2"],
      { index: 0, status: "unavailable", reason: "provider_error" },
    );

    expect(next).toEqual({
      "row-1": { status: "unavailable", reason: "provider_error" },
      "row-2": { status: "unavailable", reason: "provider_error" },
    });
  });

  it("preserves suggestions for rows outside the applied chunk", () => {
    const next = applyChunkResult(
      { "row-9": { status: "cleaned", text: "Untouched" } },
      ["row-1"],
      { index: 0, status: "ok", suggestions: [] },
    );

    expect(next).toEqual({
      "row-9": { status: "cleaned", text: "Untouched" },
      "row-1": { status: "none" },
    });
  });
});

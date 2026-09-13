import { describe, expect, it } from "vitest";
import { readNoteField } from "./note";

describe("readNoteField", () => {
  it("trims the note and reports the trimmed length", () => {
    expect(readNoteField("  hello  ")).toEqual({
      value: "hello",
      length: 5,
      error: null,
    });
  });

  it("reads a whitespace-only note as absent", () => {
    expect(readNoteField("   ")).toEqual({
      value: null,
      length: 0,
      error: null,
    });
  });

  it("accepts a note at exactly the maximum length", () => {
    expect(readNoteField("x".repeat(500))).toEqual({
      value: "x".repeat(500),
      length: 500,
      error: null,
    });
  });

  it("accepts a maximum-length note padded with whitespace", () => {
    expect(readNoteField(`  ${"x".repeat(500)}  `)).toEqual({
      value: "x".repeat(500),
      length: 500,
      error: null,
    });
  });

  it("rejects a note one character over the maximum", () => {
    expect(readNoteField("x".repeat(501))).toEqual({
      value: "x".repeat(501),
      length: 501,
      error: "Note must be 500 characters or fewer.",
    });
  });
});

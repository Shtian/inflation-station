import { describe, expect, it } from "vitest";
import {
  parseDelimitedLine,
  resolveDelimiter,
  tokenizeCsv,
} from "./csv-tokenizer";

describe("parseDelimitedLine", () => {
  it("splits quoted delimiters and unescapes doubled quotes", () => {
    const cells = parseDelimitedLine(
      '"Store; with a semicolon";"Say ""hi""";100',
      ";",
    );

    expect(cells).toEqual(["Store; with a semicolon", 'Say "hi"', "100"]);
  });

  it("splits quoted commas for comma-delimited lines", () => {
    const cells = parseDelimitedLine('"Groceries, weekly",123.45', ",");

    expect(cells).toEqual(["Groceries, weekly", "123.45"]);
  });
});

describe("resolveDelimiter", () => {
  it("infers semicolon when it produces more cells than comma", () => {
    expect(resolveDelimiter("Dato;Beløp;Type")).toBe(";");
  });

  it("infers comma when it produces more cells than semicolon", () => {
    expect(resolveDelimiter("Date,Amount,Type")).toBe(",");
  });

  it("prefers an explicit delimiter over inference", () => {
    expect(resolveDelimiter("Date,Amount,Type", ";")).toBe(";");
  });
});

describe("tokenizeCsv", () => {
  it("skips blank lines and a non-header preamble to find the header row", () => {
    const csv = tokenizeCsv(
      "\n\nStatement export\n\nDato;Beløp\n01.01.2026;100,00\n",
    );

    expect(csv?.headerLine).toBe("Dato;Beløp");
    expect(csv?.headerCells).toEqual(["Dato", "Beløp"]);
    expect(csv?.dataLines).toEqual(["01.01.2026;100,00"]);
  });

  it("handles CRLF line endings identically to LF", () => {
    const csv = tokenizeCsv(
      "Dato;Beløp\r\n01.01.2026;100,00\r\n02.01.2026;50,00",
    );

    expect(csv?.dataLines).toEqual(["01.01.2026;100,00", "02.01.2026;50,00"]);
  });

  it("returns null for content with no header-like line", () => {
    expect(tokenizeCsv("\n\n   \n")).toBeNull();
  });
});

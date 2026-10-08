import { describe, expect, it } from "vitest";

import {
  createCsvStatement,
  inferCsvDelimiter,
  normalizeCsvHeader,
  tokenizeCsv,
} from "./csv-statement";

describe("normalizeCsvHeader", () => {
  it("folds Nordic characters, lowercases, and strips non-alphanumeric characters", () => {
    expect(normalizeCsvHeader("Bokføringsdato")).toBe("bokforingsdato");
    expect(normalizeCsvHeader("Beløp")).toBe("belop");
    expect(normalizeCsvHeader(" Ærlig Å-Verdi ")).toBe("aerligaverdi");
  });

  it("is deterministic across repeated calls", () => {
    expect(normalizeCsvHeader("Bokføringsdato")).toBe(
      normalizeCsvHeader("Bokføringsdato"),
    );
  });
});

describe("tokenizeCsv", () => {
  it("tokenizes semicolon-delimited statements", () => {
    const csv = "Dato;Beløp;Navn\n01.01.2026;100,00;Alice";

    const result = tokenizeCsv(csv, ";");

    expect(result.delimiter).toBe(";");
    expect(result.headerRow).toEqual({
      sourceRowNumber: 1,
      cells: ["Dato", "Beløp", "Navn"],
    });
    expect(result.normalizedHeaders).toEqual(["dato", "belop", "navn"]);
    expect(result.dataRows).toEqual([
      { sourceRowNumber: 2, cells: ["01.01.2026", "100,00", "Alice"] },
    ]);
  });

  it("tokenizes comma-delimited statements through the same contract", () => {
    const csv = "Dato,Beløp,Navn\n01.01.2026,100.00,Alice";

    const result = tokenizeCsv(csv, ",");

    expect(result.delimiter).toBe(",");
    expect(result.headerRow?.cells).toEqual(["Dato", "Beløp", "Navn"]);
    expect(result.dataRows).toEqual([
      { sourceRowNumber: 2, cells: ["01.01.2026", "100.00", "Alice"] },
    ]);
  });

  it("keeps a delimiter literal inside quoted cells", () => {
    const csv = 'Dato;Beløp;Navn\n01.01.2026;100,00;"Doe; Jane"';

    const result = tokenizeCsv(csv, ";");

    expect(result.dataRows[0].cells).toEqual([
      "01.01.2026",
      "100,00",
      "Doe; Jane",
    ]);
  });

  it("keeps a comma delimiter literal inside quoted cells", () => {
    const csv = 'Dato,Beløp,Navn\n01.01.2026,100.00,"Doe, Jane"';

    const result = tokenizeCsv(csv, ",");

    expect(result.dataRows[0].cells).toEqual([
      "01.01.2026",
      "100.00",
      "Doe, Jane",
    ]);
  });

  it("unescapes doubled double-quotes inside a quoted cell", () => {
    const csv = 'Dato;Navn\n01.01.2026;"Jane ""JJ"" Doe"';

    const result = tokenizeCsv(csv, ";");

    expect(result.dataRows[0].cells).toEqual(["01.01.2026", 'Jane "JJ" Doe']);
  });

  it("terminates lines on both CRLF and LF and keeps correct cells", () => {
    const csv = "Dato;Navn\r\n01.01.2026;Alice\n02.01.2026;Bob\r\n";

    const result = tokenizeCsv(csv, ";");

    expect(result.dataRows).toEqual([
      { sourceRowNumber: 2, cells: ["01.01.2026", "Alice"] },
      { sourceRowNumber: 3, cells: ["02.01.2026", "Bob"] },
    ]);
  });

  it("skips blank lines but still counts them toward source row numbers", () => {
    const csv = [
      "Dato;Navn",
      "",
      "01.01.2026;Alice",
      "",
      "02.01.2026;Bob",
    ].join("\n");

    const result = tokenizeCsv(csv, ";");

    expect(result.headerRow?.sourceRowNumber).toBe(1);
    expect(result.dataRows).toEqual([
      { sourceRowNumber: 3, cells: ["01.01.2026", "Alice"] },
      { sourceRowNumber: 5, cells: ["02.01.2026", "Bob"] },
    ]);
  });

  it("skips a non-header preamble and blank lines to find the header row", () => {
    const csv = ["12345", "", "Dato;Navn", "01.01.2026;Alice"].join("\n");

    const result = tokenizeCsv(csv, ";");

    expect(result.headerRow).toEqual({
      sourceRowNumber: 3,
      cells: ["Dato", "Navn"],
    });
    expect(result.dataRows).toEqual([
      { sourceRowNumber: 4, cells: ["01.01.2026", "Alice"] },
    ]);
  });

  it("returns a null header row and no data rows when nothing looks like a header", () => {
    const result = tokenizeCsv("12345\n67890", ";");

    expect(result.headerRow).toBeNull();
    expect(result.normalizedHeaders).toEqual([]);
    expect(result.dataRows).toEqual([]);
  });

  it("trims surrounding whitespace from unquoted cells", () => {
    const csv = "Dato;Navn\n 01.01.2026 ;  Alice  ";

    const result = tokenizeCsv(csv, ";");

    expect(result.dataRows[0].cells).toEqual(["01.01.2026", "Alice"]);
  });
});

describe("inferCsvDelimiter", () => {
  it("infers semicolon when it yields at least as many header cells", () => {
    expect(inferCsvDelimiter("Dato;Beløp;Navn\n01.01.2026;100,00;Alice")).toBe(
      ";",
    );
  });

  it("infers comma when it yields strictly more header cells than semicolon", () => {
    expect(inferCsvDelimiter("Dato,Beløp,Navn\n01.01.2026,100.00,Alice")).toBe(
      ",",
    );
  });

  it("defaults to semicolon on a tie, including a single-cell header", () => {
    expect(inferCsvDelimiter("Dato\n01.01.2026")).toBe(";");
  });
});

describe("createCsvStatement", () => {
  it("exposes the original content and the inferred delimiter", () => {
    const content = "Dato,Beløp\n01.01.2026,100.00";

    const statement = createCsvStatement(content);

    expect(statement.content).toBe(content);
    expect(statement.inferredDelimiter).toBe(",");
  });

  it("tokenizes with the inferred delimiter by default", () => {
    const statement = createCsvStatement("Dato,Beløp\n01.01.2026,100.00");

    const tokenized = statement.tokenize();

    expect(tokenized.delimiter).toBe(",");
    expect(tokenized.headerRow?.cells).toEqual(["Dato", "Beløp"]);
  });

  it("memoizes tokenization so repeated calls for the same delimiter return the same result", () => {
    const statement = createCsvStatement("Dato;Beløp\n01.01.2026;100,00");

    const first = statement.tokenize(";");
    const second = statement.tokenize(";");

    expect(first).toBe(second);
  });

  it("tokenizes independently and consistently per explicit delimiter", () => {
    const statement = createCsvStatement("Dato;Beløp\n01.01.2026;100,00");

    const semicolon = statement.tokenize(";");
    const comma = statement.tokenize(",");

    expect(semicolon.headerRow?.cells).toEqual(["Dato", "Beløp"]);
    expect(comma.headerRow?.cells).toEqual(["Dato;Beløp"]);
  });

  it("lets detection and parsing observe identical cells for the same delimiter", () => {
    const statement = createCsvStatement(
      "Dato;Beløp;Navn\n01.01.2026;100,00;Alice",
    );

    const detectionView = statement.tokenize(statement.inferredDelimiter);
    const parsingView = statement.tokenize(statement.inferredDelimiter);

    expect(detectionView).toBe(parsingView);
  });
});

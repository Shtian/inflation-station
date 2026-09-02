import { describe, expect, it } from "vitest";
import { builtInProviderAdapter } from "./built-in-adapter";
import { tokenizeCsv } from "./csv-tokenizer";

const HEADER =
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype";

describe("builtInProviderAdapter", () => {
  it("scores a full required-header match and then parses the same fixture", () => {
    const csvContent = `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`;
    const csv = tokenizeCsv(csvContent);
    if (!csv) throw new Error("expected a tokenized CSV");

    const detection = builtInProviderAdapter.detect(csv);
    expect(detection.requiredMatches).toBe(detection.requiredTotal);
    expect(detection.score).toBe(1);

    const parsed = builtInProviderAdapter.parse(csvContent);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
  });

  it("scores a partial match below 1 when a required header is missing", () => {
    const csv = tokenizeCsv("Bokføringsdato;Beløp\n01.01.2026;100,00");
    if (!csv) throw new Error("expected a tokenized CSV");

    const detection = builtInProviderAdapter.detect(csv);
    expect(detection.score).toBeLessThan(1);
    expect(detection.score).toBeGreaterThan(0);
  });

  it("is selectable through the same ProviderAdapter interface as compiled mappings", () => {
    expect(typeof builtInProviderAdapter.detect).toBe("function");
    expect(typeof builtInProviderAdapter.parse).toBe("function");
    expect(builtInProviderAdapter.id).toBe("built-in-norwegian");
  });
});

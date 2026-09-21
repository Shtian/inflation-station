import { describe, expect, it } from "vitest";

import amexSeptember from "./__fixtures__/amex-2026-09.json";
import trumfSeptember from "./__fixtures__/trumf-2026-09.json";
import { detectPdfStatementExtractor } from "./registry";
import type { StatementItem } from "./statement-items";

describe("detectPdfStatementExtractor", () => {
  it("routes a Trumf statement to the Trumf extractor", () => {
    const document = trumfSeptember as StatementItem[];
    const extractor = detectPdfStatementExtractor(document);

    expect(extractor?.providerId).toBe("trumf");
    expect(extractor?.extract(document).parsed.rows).toHaveLength(39);
  });

  it("routes an Amex statement to the Amex extractor", () => {
    const document = amexSeptember as StatementItem[];
    const extractor = detectPdfStatementExtractor(document);

    expect(extractor?.providerId).toBe("amex");
    expect(extractor?.extract(document).parsed.rows).toHaveLength(9);
  });

  it("returns null for an empty document", () => {
    expect(detectPdfStatementExtractor([])).toBeNull();
  });

  it("returns null for an unrecognized issuer", () => {
    expect(
      detectPdfStatementExtractor([
        { page: 1, y: 800, x: 20, text: "Some other bank AS" },
      ]),
    ).toBeNull();
  });
});

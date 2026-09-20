import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import trumfSeptember from "./__fixtures__/trumf-2026-09.json";
import { extractStatementItems } from "./extract-items";
import { trumfPdfStatementExtractor } from "./providers/trumf";
import { type StatementItem, statementDriftNok } from "./statement-items";

const FIXTURE_PDF = new URL(
  "./__fixtures__/trumf-2026-09.pdf",
  import.meta.url,
);

function readFixtureItems(): Promise<StatementItem[]> {
  return readFile(FIXTURE_PDF).then((bytes) =>
    extractStatementItems(new Uint8Array(bytes)),
  );
}

describe("extractStatementItems", () => {
  it("recovers the September statement's items from the PDF itself", async () => {
    expect(await readFixtureItems()).toEqual(trumfSeptember as StatementItem[]);
  });

  it("hands the Trumf extractor a document it reads without drift", async () => {
    const items = await readFixtureItems();

    expect(trumfPdfStatementExtractor.detect(items)).toBe(true);

    const { parsed, reconciliation } =
      trumfPdfStatementExtractor.extract(items);

    expect(parsed.rows).toHaveLength(39);
    expect(parsed.errors).toEqual([]);
    expect(reconciliation).toEqual({
      openingNok: -10000,
      movementNok: 8907.94,
      closingNok: -1092.06,
    });
    expect(reconciliation && statementDriftNok(reconciliation)).toBe(0);
  });
});

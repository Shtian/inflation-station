import { describe, expect, it } from "vitest";

import trumfSeptember from "../../src/lib/import/pdf/__fixtures__/trumf-2026-09.json";
import { extractStatementItems } from "../../src/lib/import/pdf/extract-items";
import type { StatementItem } from "../../src/lib/import/pdf/statement-items";
import { renderStatementPdf } from "./statement-pdf";

describe("renderStatementPdf", () => {
  // extract-items.test.ts only reads the committed PDF, so a chromium upgrade
  // that moved a coordinate would stay hidden until someone regenerated and
  // trusted the result. Rendering fresh here is what dates that breakage.
  it("renders items chromium prints back at the coordinates they came from", async () => {
    const items = trumfSeptember as StatementItem[];

    expect(
      await extractStatementItems(await renderStatementPdf(items)),
    ).toEqual(items);
  }, 60_000);
});

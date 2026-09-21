import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { INTEGRATED_DB_LOCK, layFixture } from "../support/integrated-database";

const ACCOUNT = "Integrated Credit Card";

// Playwright compiles specs to CommonJS, so `import.meta.url` is unavailable
// here even though the Vitest suites next door use it.
const FIXTURE_PDF = path.resolve(
  __dirname,
  "../../src/lib/import/pdf/__fixtures__/trumf-2026-09.pdf",
);

test(
  "parses an uploaded PDF statement and reaches the review step with every row",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [{ name: ACCOUNT }],
      transactions: [],
    });

    await page.goto("/import");
    await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
    await page.getByLabel("Statement file").setInputFiles({
      name: "trumf-2026-09.pdf",
      mimeType: "application/pdf",
      buffer: await readFile(FIXTURE_PDF),
    });
    await page.getByRole("button", { name: "Parse & Preview" }).click();

    await expect(page.getByText("Import Preview")).toBeVisible();
    await expect(page.getByText("Trumf Kredittkort")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import 39 / 39" }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /^Select row / }),
    ).toHaveCount(39);
  },
);

import { expect, test } from "@playwright/test";
import { INTEGRATED_DB_LOCK, layFixture } from "../support/integrated-database";

const ACCOUNT = "Integrated Checking";
const ORIGINAL_MESSAGE = "Espresso og croissant";
const CSV_CONTENT = [
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype",
  "01.03.2026;100,00;Alice;Kaffeslabberas;Kaffeslabberas;Espresso og croissant;NOK;Kort",
].join("\n");

test(
  "reaches a working review table and persists the original message when OPENAI_API_KEY is unset",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [{ name: ACCOUNT }],
      transactions: [],
    });

    const cleanupRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/imports/cleanup")) {
        cleanupRequests.push(request.url());
      }
    });

    await page.goto("/import");
    await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
    await page.getByLabel("CSV file").setInputFiles({
      name: "transactions.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(CSV_CONTENT, "utf8"),
    });
    await page.getByRole("button", { name: "Parse & Preview" }).click();

    await expect(page.getByText("Import Preview")).toBeVisible();
    await expect(
      page.getByText("Message cleanup unavailable: OPENAI_API_KEY is missing."),
    ).toBeVisible();
    await expect(
      page.getByText(ORIGINAL_MESSAGE, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Toggle message source for row/ }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Import 1 / 1" }).click();
    await expect(
      page.locator("[data-sonner-toast]", {
        hasText: "Import complete. Imported 1, invalid 0.",
      }),
    ).toBeVisible();

    expect(cleanupRequests).toEqual([]);

    const settled = page.waitForResponse((response) =>
      response.url().includes("/api/transactions?"),
    );
    await page.goto("/transactions");
    await settled;
    await expect(page.getByText(ORIGINAL_MESSAGE)).toBeVisible();
  },
);

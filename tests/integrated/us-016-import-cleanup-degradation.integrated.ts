import { expect, test } from "@playwright/test";
import { INTEGRATED_DB_LOCK, layFixture } from "../support/integrated-database";

const ACCOUNT = "Integrated Checking";
// The guessed mapping joins Navn and Tittel into the description.
const ORIGINAL_MESSAGE = "Kaffeslabberas Espresso og croissant";
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
    await page.getByLabel("Kontoutskrift").setInputFiles({
      name: "transactions.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(CSV_CONTENT, "utf8"),
    });
    await page.getByRole("button", { name: "Les inn og forhåndsvis" }).click();
    await page.getByRole("button", { name: "Bekreft kobling" }).click();

    await expect(page.getByText("Forhåndsvisning av import")).toBeVisible();
    await expect(
      page.getByText(
        "Meldingsrydding er utilgjengelig: OPENAI_API_KEY mangler.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(ORIGINAL_MESSAGE, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Bytt meldingskilde for rad/ }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Importer 1 / 1" }).click();
    await expect(
      page.locator("[data-sonner-toast]", {
        hasText: "Import fullført. Importert: 1, ugyldige: 0.",
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

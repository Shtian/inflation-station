import { expect, test } from "@playwright/test";
import { INTEGRATED_DB_LOCK, layFixture } from "../support/integrated-database";

const ACCOUNT = "Integrated DNB Checking";
const DNB_CSV = [
  '"Dato";"Forklaring";"Rentedato";"Ut fra konto";"Inn på konto"',
  '"02.01.2026";"Kiwi Majorstuen";"02.01.2026";"249,90";""',
  '"03.01.2026";"Lønn";"03.01.2026";"";"35 000,00"',
].join("\n");

test(
  "saves the confirmed column mapping on the account and reuses it for the next file with the same headers",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [{ name: ACCOUNT }],
      transactions: [],
    });

    const upload = async () => {
      await page.goto("/import");
      await page.getByRole("button", { name: ACCOUNT, exact: true }).click();
      await page.getByLabel("Statement file").setInputFiles({
        name: "dnb.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(DNB_CSV, "utf8"),
      });
      await page.getByRole("button", { name: "Parse & Preview" }).click();
    };

    await upload();

    await expect(
      page.getByRole("heading", { name: "Map Columns" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Money out column" }),
    ).toHaveText(/^Ut fra konto/);
    await page.getByRole("button", { name: "Confirm mapping" }).click();

    await expect(page.getByText("Import Preview")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import 2 / 2" }),
    ).toBeVisible();
    await expect(page.getByText("Kiwi Majorstuen")).toBeVisible();

    await upload();

    await expect(page.getByText("Import Preview")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Map Columns" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Dato · Inn på konto / Ut fra konto · Forklaring"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import 2 / 2" }),
    ).toBeVisible();
  },
);

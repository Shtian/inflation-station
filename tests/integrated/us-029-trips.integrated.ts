import { expect, type Page, test } from "@playwright/test";
import {
  type FixtureTransaction,
  INTEGRATED_DB_LOCK,
  layFixture,
} from "../support/integrated-database";

const ACCOUNT = "Brukskonto";

function spend(
  bookingDate: string,
  amountNok: number,
  merchant: string,
  category?: string,
): FixtureTransaction {
  return { account: ACCOUNT, bookingDate, amountNok, merchant, category };
}

function toast(page: Page, text: string) {
  return page.locator("[data-sonner-toast]", { hasText: text });
}

test(
  "creates a trip, tags the trip's spending and a booking made weeks before, and sums it up",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [{ name: ACCOUNT }],
      categories: [
        { name: "Reise" },
        { name: "Restaurant" },
        { name: "Husleie" },
        { name: "Lønn", kind: "INCOME" },
      ],
      transactions: [
        spend("2026-03-10", -2400, "Norwegian Air", "Reise"),
        spend("2026-05-01", -12000, "Utleier AS", "Husleie"),
        spend("2026-05-02", -650, "Time Out Market", "Restaurant"),
        spend("2026-05-03", -350, "Pastelaria Batalha", "Restaurant"),
        spend("2026-05-05", 30000, "Arbeidsgiver", "Lønn"),
      ],
    });

    await page.goto("/trips");
    await expect(page.getByText("Ingen turer ennå.")).toBeVisible();

    await page.getByRole("button", { name: "Ny tur" }).click();
    const dialog = page.getByRole("dialog", { name: "Ny tur" });
    await dialog.getByLabel("Navn").fill("Lisboa");
    await dialog.getByLabel("Startdato").fill("2026-05-01");
    await dialog.getByLabel("Sluttdato").fill("2026-05-05");
    await dialog.getByRole("button", { name: "Opprett tur" }).click();

    await expect(toast(page, "Turen er opprettet.")).toBeVisible();
    await expect(page).toHaveURL(/\/trips\/[^/]+$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Lisboa" }),
    ).toBeVisible();

    const inRange = page.getByRole("table", {
      name: "Transaksjoner i perioden",
    });
    const checkbox = (merchant: string) =>
      inRange.getByRole("checkbox", {
        name: new RegExp(`^Ta med ${merchant}`),
      });
    await expect(checkbox("Time Out Market")).toBeChecked();
    await expect(checkbox("Pastelaria Batalha")).toBeChecked();
    await expect(checkbox("Utleier AS")).toBeChecked();
    await expect(checkbox("Arbeidsgiver")).not.toBeChecked();

    await checkbox("Utleier AS").click();
    await page.getByRole("button", { name: "Lagre utvalg" }).click();
    await expect(toast(page, "2 lagt til i turen.")).toBeVisible();

    await page.getByLabel("Brukersted, notat eller kategori").fill("norwegian");
    await page.getByRole("button", { name: "Søk", exact: true }).click();
    const results = page.getByRole("table", { name: "Søkeresultater" });
    await expect(results.getByRole("row")).toHaveCount(2);
    await results
      .getByRole("checkbox", { name: /^Ta med Norwegian Air/ })
      .click();
    await page.getByRole("button", { name: "Legg til valgte" }).click();
    await expect(toast(page, "1 lagt til i turen.")).toBeVisible();

    const totals = page.getByRole("definition");
    await expect(totals).toHaveText([/^3\s400\skr$/, /^680\skr$/, "3"]);
    await expect(
      page
        .getByRole("list", { name: "Kostnad per kategori" })
        .getByRole("listitem"),
    ).toHaveText([/^Reise\s*2\s400\skr$/, /^Restaurant\s*1\s000\skr$/]);
    await expect(
      page.getByRole("table", { name: "Før turen" }).getByRole("row"),
    ).toHaveText(["DatoBrukerstedKategoriBeløpHandlinger", /Norwegian Air/]);
    await expect(
      page
        .getByRole("table", { name: "Under turen" })
        .locator('[data-slot="table-body"] tr'),
    ).toHaveText([/Time Out Market/, /Pastelaria Batalha/]);

    await page
      .getByRole("link", { name: "Turer", exact: true })
      .first()
      .click();
    await expect(
      page
        .getByRole("table", { name: "Turer" })
        .locator('[data-slot="table-body"] tr'),
    ).toHaveText([/^Lisboa1\.\s?–\s?5\. mai 20265 dager3\s400\skr$/]);
  },
);

test(
  "sets a transaction's trip from the transactions edit dialog",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [{ name: ACCOUNT }],
      trips: [
        { name: "Lisboa", startDate: "2026-05-01", endDate: "2026-05-05" },
      ],
      transactions: [spend("2026-05-02", -200, "Taxi Aeroporto")],
    });

    const listed = page.waitForResponse((response) =>
      response.url().includes("/api/transactions?"),
    );
    await page.goto("/transactions");
    await listed;

    const row = page
      .locator('[data-slot="table-body"] tr')
      .filter({ hasText: "Taxi Aeroporto" });
    await row.hover();
    await row
      .getByRole("button", {
        name: "Handlinger for transaksjon fra 2026-05-02",
      })
      .click();
    await page.getByRole("menuitem", { name: "Rediger" }).click();

    const dialog = page.getByRole("dialog", { name: "Rediger transaksjon" });
    await dialog.getByLabel("Tur").click();
    await page.getByRole("option", { name: /^Lisboa \(/ }).click();
    await dialog.getByRole("button", { name: "Lagre endringer" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/trips");
    await page.getByRole("link", { name: "Lisboa" }).click();
    await expect(
      page
        .getByRole("table", { name: "Under turen" })
        .locator('[data-slot="table-body"] tr'),
    ).toHaveText([/Taxi Aeroporto/]);
    await expect(page.getByRole("definition").first()).toHaveText(/^200\skr$/);
  },
);

import { expect, type Locator, type Page, test } from "@playwright/test";
import { INTEGRATED_DB_LOCK, layFixture } from "../support/integrated-database";

const ACCOUNT = "Integrated Checking";
const CATEGORY = "Integrated Groceries";

const MINUS_SIGN = String.fromCodePoint(0x2212);
const NBSP = String.fromCodePoint(0x00a0);

function bodyRows(page: Page): Locator {
  return page.locator('[data-slot="table-body"] tr');
}

function rowFor(page: Page, merchant: string): Locator {
  return bodyRows(page).filter({ hasText: merchant });
}

function memoButton(page: Page, bookingDate: string): Locator {
  return page.getByRole("button", {
    name: `View memo for transaction from ${bookingDate}`,
  });
}

function transactionsResponse(page: Page, globalQuery?: string) {
  return page.waitForResponse((response) => {
    if (!response.url().includes("/api/transactions?")) {
      return false;
    }

    return (
      globalQuery === undefined ||
      new URL(response.url()).searchParams.get("globalQuery") === globalQuery
    );
  });
}

async function openTransactions(page: Page): Promise<void> {
  const settled = transactionsResponse(page);
  await page.goto("/transactions");
  await settled;
}

async function reloadTransactions(page: Page): Promise<void> {
  const settled = transactionsResponse(page);
  await page.reload();
  await settled;
}

async function searchFor(page: Page, query: string): Promise<void> {
  const settled = transactionsResponse(page, query);
  await page.getByLabel("Search", { exact: true }).fill(query);
  await settled;
}

async function openRowActions(
  page: Page,
  merchant: string,
  bookingDate: string,
): Promise<void> {
  const row = rowFor(page, merchant);
  await row.hover();
  await row
    .getByRole("button", {
      name: `Actions for transaction from ${bookingDate}`,
    })
    .click();
}

test(
  "rewrites the merchant search key when a merchant is edited",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [{ name: ACCOUNT }],
      categories: [{ name: CATEGORY }],
      transactions: [
        {
          account: ACCOUNT,
          category: CATEGORY,
          bookingDate: "2026-03-04",
          amountNok: -249.9,
          merchant: "Kaffeslabberas Gamlebyen",
        },
        {
          account: ACCOUNT,
          bookingDate: "2026-03-05",
          amountNok: -120,
          merchant: "Rimi Storgata",
          note: "Weekly shop",
        },
      ],
    });

    await openTransactions(page);
    await openRowActions(page, "Kaffeslabberas Gamlebyen", "2026-03-04");
    await page.getByRole("menuitem", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: "Edit transaction" });
    await expect(dialog.getByLabel("Merchant")).toHaveValue(
      "Kaffeslabberas Gamlebyen",
    );
    await dialog.getByLabel("Merchant").fill("Bæveren Ølhus Bryggeri");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog).toBeHidden();
    const edited = rowFor(page, "Bæveren Ølhus Bryggeri");
    await expect(edited).toContainText(`${MINUS_SIGN}249,90${NBSP}kr`);

    await searchFor(page, "baeveren olhus bryggeri");
    await expect(bodyRows(page)).toHaveCount(1);
    await expect(bodyRows(page).first()).toContainText(
      "Bæveren Ølhus Bryggeri",
    );

    await searchFor(page, "Kaffeslabberas");
    await expect(
      page.getByText("No transactions found for the selected filters."),
    ).toBeVisible();
  },
);

test(
  "creates a transaction from the Add dialog",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [{ name: ACCOUNT }],
      categories: [{ name: CATEGORY }],
      transactions: [],
    });

    await openTransactions(page);
    await expect(page.getByText("No transactions found.")).toBeVisible();

    await page.getByRole("button", { name: "Add transaction" }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });

    await dialog.locator("#add-account-id").click();
    await page.getByRole("option", { name: ACCOUNT, exact: true }).click();
    await dialog.locator("#add-booking-date").fill("2026-03-11");
    await dialog.locator("#add-merchant").fill("Bakeriet på Hjørnet");
    await dialog.locator("#add-amount-nok").fill("1234,50");
    await dialog.locator("#add-payment-type").click();
    await page.getByRole("option", { name: "CARD", exact: true }).click();
    await dialog.locator("#add-category-id").click();
    await page.getByRole("option", { name: CATEGORY, exact: true }).click();
    await dialog.locator("#add-note").fill("Fredagsbolle");

    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(
      page.locator("[data-sonner-toast]", { hasText: "Transaction added" }),
    ).toBeVisible();

    await reloadTransactions(page);
    const created = rowFor(page, "Bakeriet på Hjørnet");
    await expect(created).toContainText("2026-03-11");
    await expect(created).toContainText(`1${NBSP}234,50${NBSP}kr`);
    await expect(created).toContainText(CATEGORY);
    await expect(memoButton(page, "2026-03-11")).toBeVisible();
  },
);

test(
  "clears a note through the edit dialog",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [{ name: ACCOUNT }],
      transactions: [
        {
          account: ACCOUNT,
          bookingDate: "2026-03-04",
          amountNok: -249.9,
          merchant: "Kaffeslabberas Gamlebyen",
          note: "Reimburse Ola",
        },
      ],
    });

    await openTransactions(page);
    await expect(memoButton(page, "2026-03-04")).toBeVisible();

    await openRowActions(page, "Kaffeslabberas Gamlebyen", "2026-03-04");
    await page.getByRole("menuitem", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: "Edit transaction" });
    await expect(dialog.getByLabel("Note")).toHaveValue("Reimburse Ola");
    await dialog.getByLabel("Note").fill("");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toBeHidden();

    await reloadTransactions(page);
    await expect(rowFor(page, "Kaffeslabberas Gamlebyen")).toBeVisible();
    await expect(memoButton(page, "2026-03-04")).toHaveCount(0);
  },
);

test(
  "deletes a transaction from the row menu",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [{ name: ACCOUNT }],
      transactions: [
        {
          account: ACCOUNT,
          bookingDate: "2026-03-04",
          amountNok: -249.9,
          merchant: "Kaffeslabberas Gamlebyen",
        },
        {
          account: ACCOUNT,
          bookingDate: "2026-03-05",
          amountNok: -120,
          merchant: "Rimi Storgata",
        },
      ],
    });

    await openTransactions(page);
    await expect(bodyRows(page)).toHaveCount(2);

    await openRowActions(page, "Kaffeslabberas Gamlebyen", "2026-03-04");
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const confirmation = page.getByRole("alertdialog", {
      name: "Delete transaction",
    });
    await expect(confirmation).toContainText(
      "This will permanently remove the selected transaction.",
    );
    await confirmation
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    await expect(confirmation).toBeHidden();
    await expect(bodyRows(page)).toHaveCount(1);
    await expect(bodyRows(page).first()).toContainText("Rimi Storgata");
    await expect(bodyRows(page).first()).toContainText(
      `${MINUS_SIGN}120,00${NBSP}kr`,
    );
  },
);

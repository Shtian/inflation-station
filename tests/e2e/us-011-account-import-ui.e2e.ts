import { expect, test } from "@playwright/test";

type MockAccount = {
  id: string;
  name: string;
  institution: string | null;
  isActive: boolean;
};

test("manages accounts and displays import summary", async ({ page }) => {
  const accounts: MockAccount[] = [
    {
      id: "acc-1",
      name: "Main Account",
      institution: "DNB",
      isActive: true,
    },
  ];

  await page.route("**/api/accounts", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accounts }),
      });
      return;
    }

    if (request.method() === "POST") {
      const body = request.postDataJSON() as {
        name: string;
        institution?: string;
      };

      const created: MockAccount = {
        id: `acc-${accounts.length + 1}`,
        name: body.name,
        institution: body.institution ?? null,
        isActive: true,
      };
      accounts.push(created);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ account: created }),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/accounts/*", async (route, request) => {
    const accountId = request.url().split("/").at(-1) ?? "";
    const index = accounts.findIndex((account) => account.id === accountId);

    if (index === -1) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "ACCOUNT_NOT_FOUND" }),
      });
      return;
    }

    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as {
        name?: string;
        institution?: string | null;
      };
      accounts[index] = {
        ...accounts[index],
        name: body.name ?? accounts[index].name,
        institution:
          body.institution === undefined
            ? accounts[index].institution
            : body.institution,
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ account: accounts[index] }),
      });
      return;
    }

    if (request.method() === "DELETE") {
      accounts.splice(index, 1);
      await route.fulfill({
        status: 204,
        contentType: "application/json",
        body: "",
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ categories: [] }),
    });
  });

  await page.route("**/api/categorization/review", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], count: 0 }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ updated: 0, skipped: 0 }),
    });
  });

  await page.route("**/api/imports", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          imported: 3,
          duplicates: 1,
          ignoredReserved: 2,
          invalid: 0,
        },
        errors: [],
      }),
    });
  });

  await page.route("**/api/dashboard/analytics**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        filters: {
          accountId: null,
          startDate: "2026-01-01",
          endDate: "2026-01-31",
        },
        netCashflow: [],
        inflowOutflow: [],
        categoryBreakdown: [],
        accountTrend: [],
      }),
    });
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Accounts, Imports, and Review" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Main Account" })).toBeVisible();

  await page.getByLabel("Account name").fill("Savings Account");
  await page.getByLabel("Institution (optional)").fill("Nordea");
  await page.getByRole("button", { name: "Add account" }).click();

  await expect(
    page.getByRole("cell", { name: "Savings Account" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Rename" }).nth(1).click();
  await page.getByLabel("Edit name Savings Account").fill("Rainy Day Account");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByRole("cell", { name: "Rainy Day Account" }),
  ).toBeVisible();

  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.getByRole("button", { name: "Remove" }).nth(1).click();

  await expect(
    page.getByRole("cell", { name: "Rainy Day Account" }),
  ).not.toBeVisible();

  await page.locator("#csv-file").setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype\n01.01.2026;10,00;A;B;C;D;NOK;Kort",
    ),
  });

  await page.getByRole("button", { name: "Import transactions" }).click();

  await expect(
    page.getByRole("heading", { name: "Import summary" }),
  ).toBeVisible();
  await expect(page.getByText("Imported").locator("..")).toContainText("3");
  await expect(page.getByText("Duplicates").locator("..")).toContainText("1");
  await expect(page.getByText("Ignored reserved").locator("..")).toContainText(
    "2",
  );
  await expect(page.getByText("Invalid").locator("..")).toContainText("0");
});

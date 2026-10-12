import { expect, type Page, test } from "@playwright/test";

async function stubSetup(
  page: Page,
  setup: { accounts: unknown[]; categories: unknown[] },
) {
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({ json: { accounts: setup.accounts } });
  });
  await page.route("**/api/categories", async (route) => {
    await route.fulfill({ json: { categories: setup.categories } });
  });
}

function step(page: Page, title: string) {
  return page
    .getByRole("list", { name: "Setup steps" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: title }) });
}

test("sends a user with no accounts from the dashboard to onboarding", async ({
  page,
}) => {
  await stubSetup(page, { accounts: [], categories: [] });
  await page.route("**/api/dashboard/analytics**", async (route) => {
    await route.fulfill({
      json: {
        filters: {
          accountId: null,
          startDate: "2026-01-01",
          endDate: "2026-01-31",
        },
        netCashflow: [],
        inflowOutflow: [],
        categoryBreakdown: [],
        accountTrend: [],
      },
    });
  });

  await page.goto("/");

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Get set up" })).toBeVisible();
});

test("starts at the accounts step on an empty setup", async ({ page }) => {
  await stubSetup(page, { accounts: [], categories: [] });

  await page.goto("/onboarding");

  await expect(step(page, "Add your accounts")).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(step(page, "Add your accounts")).toContainText("Current step");
  await expect(step(page, "Create categories")).toContainText("Up next");
  await expect(step(page, "Hide transfers")).toContainText("Up next");
  await expect(
    page.getByRole("link", { name: "Import a statement" }),
  ).toHaveCount(0);
});

test("moves to the transfer step once accounts and a spending category exist", async ({
  page,
}) => {
  await stubSetup(page, {
    accounts: [
      { id: "acc-1", name: "Brukskonto", institution: "DNB", isActive: true },
    ],
    categories: [
      {
        id: "cat-1",
        name: "Dagligvarer",
        kind: "EXPENSE",
        classifierHint: "Rema, Kiwi",
      },
    ],
  });

  await page.goto("/onboarding");

  await expect(step(page, "Hide transfers")).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(step(page, "Add your accounts")).toContainText("Done");
  await expect(step(page, "Add your accounts")).toContainText(
    "Brukskonto (DNB)",
  );
  await expect(step(page, "Create categories")).toContainText("Dagligvarer");
  await expect(step(page, "Add your accounts")).not.toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(
    page.getByRole("link", { name: "Import a statement" }),
  ).toBeVisible();
});

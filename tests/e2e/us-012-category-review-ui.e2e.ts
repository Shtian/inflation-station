import { expect, test } from "@playwright/test";

test("redirects / to /overview and renders dashboard sections", async ({
  page,
}) => {
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [
          {
            id: "acc-1",
            name: "Main Account",
            institution: "DNB",
            isActive: true,
          },
        ],
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

  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Net Cashflow" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Inflow vs Outflow" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Category Spend Breakdown" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Account State Trend" }),
  ).toBeVisible();
});

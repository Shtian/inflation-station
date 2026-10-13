import { expect, test } from "@playwright/test";

test("renders overview dashboard sections at /", async ({ page }) => {
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

  await expect(page.getByRole("heading", { name: "Oversikt" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Netto kontantstrøm" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inn og ut" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kontoutvikling" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Kategori", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Forbruk per kategori" }),
  ).toBeVisible();
});

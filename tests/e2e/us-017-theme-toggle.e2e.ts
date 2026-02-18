import { expect, test } from "@playwright/test";

test("shows theme options and applies persisted theme in the app shell", async ({
  page,
}) => {
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [],
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

  await page.goto("/overview");

  const html = page.locator("html");
  const themeToggle = page.getByRole("button", { name: "Toggle theme" });

  await expect(themeToggle).toBeVisible();

  await themeToggle.click();
  await expect(page.getByRole("menuitem", { name: "Light" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Dark" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "System" })).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.setItem("theme", "dark");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(html).toHaveClass(/\bdark\b/);
});

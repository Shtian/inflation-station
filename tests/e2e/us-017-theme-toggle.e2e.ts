import { expect, test } from "@playwright/test";

test("switches between light and dark themes from the app shell", async ({
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
  const themeToggle = page.getByRole("button", { name: "Dark mode" });

  await expect(themeToggle).toBeVisible();
  await expect(themeToggle).toHaveText("Dark mode");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await themeToggle.click();

  await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.reload();

  await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();
  await expect(html).toHaveClass(/\bdark\b/);
});

import { expect, test } from "@playwright/test";

test("switches mode and palette and keeps both across reloads", async ({
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
  for (const mode of ["Light", "Dark", "System"]) {
    await expect(page.getByRole("radio", { name: mode })).toBeVisible();
  }
  for (const palette of ["Ember", "Ocean", "Botanical", "Plum"]) {
    await expect(page.getByRole("radio", { name: palette })).toBeVisible();
  }
  await expect(page.getByRole("radio", { name: "Ember" })).toBeChecked();

  await page.locator("label", { hasText: "Ocean" }).click();
  await expect(html).toHaveAttribute("data-palette", "ocean");
  await expect(page.getByRole("radio", { name: "Ocean" })).toBeChecked();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(html).toHaveAttribute("data-palette", "ocean");

  await page.evaluate(() => {
    window.localStorage.setItem("inflation-station-theme", "light");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(html).toHaveAttribute("data-palette", "ocean");
});

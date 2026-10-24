import { expect, test } from "@playwright/test";
import packageJson from "../../package.json" with { type: "json" };

test("shows the release version in the version popover", async ({ page }) => {
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    });
  });

  await page.goto("/overview");

  await page.getByRole("button", { name: "Versjonsinfo" }).click();
  await expect(
    page.getByText(`v${packageJson.version}`, { exact: true }),
  ).toBeVisible();
});

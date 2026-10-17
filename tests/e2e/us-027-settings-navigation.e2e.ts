import { expect, test } from "@playwright/test";

test("sidebar lists primary routes in order and links to unified settings", async ({
  page,
}) => {
  await page.route("**/api/monthly-review/timeline", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rows: [] }),
    });
  });
  await page.route("**/api/monthly-review/system-prompt", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        promptText: "",
        resolvedPrompt: "You are a financial review assistant.",
        usesDefaultPrompt: true,
        modelId: null,
        resolvedModelId: "gpt-5.4-mini",
        usesDefaultModel: true,
        availableModels: ["gpt-5.4-mini"],
        availableModelsSource: "openai",
      }),
    });
  });
  await page.route("**/api/imports/message-cleanup-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        promptText: "",
        resolvedPrompt: "Trim transaction noise.",
        usesDefaultPrompt: true,
        modelId: null,
        resolvedModelId: "gpt-5.4-mini",
        usesDefaultModel: true,
        availableModels: ["gpt-5.4-mini"],
        availableModelsSource: "openai",
        reasoningEffort: null,
        resolvedReasoningEffort: "low",
        usesDefaultReasoningEffort: true,
        availableReasoningEfforts: [
          { id: "low", label: "Lav", description: "Standard." },
        ],
      }),
    });
  });

  await page.goto("/monthly-review");

  const mainNavigation = page.getByRole("navigation", { name: "Hovedmeny" });
  await expect(mainNavigation.getByRole("link")).toHaveText([
    "Oversikt",
    "Transaksjoner",
    "Import",
    "Månedsoppsummering",
    "Innsikt",
    "Kontoer",
    "Kategorier",
  ]);
  await expect(page.locator('a[href="/onboarding"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Oppsettsguide" })).toHaveCount(
    0,
  );

  const settingsLink = page.getByRole("link", {
    name: "Innstillinger",
    exact: true,
  });
  await settingsLink.click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(settingsLink).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { level: 1, name: "Innstillinger" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Import", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Månedsoppsummering" }),
  ).toBeVisible();
});

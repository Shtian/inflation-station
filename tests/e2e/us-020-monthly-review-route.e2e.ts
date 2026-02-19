import { expect, test } from "@playwright/test";

test("renders monthly review timeline cards with deterministic overview data", async ({
  page,
}) => {
  const generateRequests: Array<{ monthStart?: string }> = [];

  await page.route("**/api/monthly-review/timeline", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [
          {
            monthStart: "2026-04-01",
            totalSpendNok: 1850,
            transactionCount: 9,
            topCategory: {
              categoryId: "cat-groceries",
              categoryName: "Groceries",
              spendNok: 820,
            },
            monthOverMonthSpendDeltaNok: 100,
            reviewState: "GENERATING",
            generatedAt: null,
            errorMessage: null,
            reviewText: null,
          },
          {
            monthStart: "2026-03-01",
            totalSpendNok: 1725,
            transactionCount: 8,
            topCategory: {
              categoryId: "cat-utilities",
              categoryName: "Utilities",
              spendNok: 760,
            },
            monthOverMonthSpendDeltaNok: -125,
            reviewState: "FAILED",
            generatedAt: "2026-03-28T14:00:00.000Z",
            errorMessage: "provider_error",
            reviewText: null,
          },
          {
            monthStart: "2026-01-01",
            totalSpendNok: 1400,
            transactionCount: 6,
            topCategory: {
              categoryId: "cat-food",
              categoryName: "Food",
              spendNok: 700,
            },
            monthOverMonthSpendDeltaNok: null,
            reviewState: "NOT_GENERATED",
            generatedAt: null,
            errorMessage: null,
            reviewText: null,
          },
          {
            monthStart: "2026-02-01",
            totalSpendNok: 1600,
            transactionCount: 7,
            topCategory: {
              categoryId: "cat-rent",
              categoryName: "Rent",
              spendNok: 900,
            },
            monthOverMonthSpendDeltaNok: 200,
            reviewState: "GENERATED",
            generatedAt: "2026-02-15T10:00:00.000Z",
            errorMessage: null,
            reviewText:
              "Spending increased due to rent and utilities. Dining out was also higher than last month, while transport costs stayed stable.",
          },
        ],
      }),
    });
  });

  await page.route("**/api/monthly-review/generate", async (route) => {
    const payload = route.request().postDataJSON() as
      | { monthStart?: string }
      | undefined;
    generateRequests.push(payload ?? {});

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        monthStart: payload?.monthStart ?? null,
        status: "GENERATING",
        generatedAt: null,
        errorMessage: null,
        reviewText: null,
        unavailableReason: null,
      }),
    });
  });

  await page.goto("/monthly-review");

  await expect(
    page.getByRole("heading", { name: "Monthly Review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open monthly review settings" }),
  ).toBeVisible();

  const monthHeadings = page.locator("article h2");
  await expect(monthHeadings).toHaveCount(4);
  await expect(monthHeadings.nth(0)).toHaveText("April 2026");
  await expect(monthHeadings.nth(1)).toHaveText("March 2026");
  await expect(monthHeadings.nth(2)).toHaveText("February 2026");
  await expect(monthHeadings.nth(3)).toHaveText("January 2026");

  await expect(page.getByText("Total spend").first()).toBeVisible();
  await expect(page.getByText(/1\s?600,00/).first()).toBeVisible();
  await expect(page.getByText("Transactions").first()).toBeVisible();
  await expect(page.getByText("9").first()).toBeVisible();
  await expect(page.getByText(/Rent \(/)).toBeVisible();
  await expect(
    page.getByText("Review generation is in progress for this month."),
  ).toBeVisible();
  await expect(
    page.getByText("Generation failed: provider_error"),
  ).toBeVisible();

  const generatedMonthCard = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "February 2026" }) });
  await expect(generatedMonthCard.getByText("Review preview")).toBeVisible();
  await expect(
    generatedMonthCard.getByText(
      /Spending increased due to rent and utilities/,
    ),
  ).toBeVisible();
  await generatedMonthCard
    .getByRole("button", { name: "View full review" })
    .click();
  await expect(
    generatedMonthCard.locator("p.whitespace-pre-wrap"),
  ).toBeVisible();
  await generatedMonthCard
    .getByRole("button", { name: "Hide full review" })
    .click();

  await expect(
    page.getByText("No review generated for this month yet."),
  ).toBeVisible();

  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "January 2026" }) })
    .getByRole("button", { name: "Generate review" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Generate monthly review?" }),
  ).toBeVisible();
  await expect(
    page.getByText("This will generate a monthly AI review for January 2026."),
  ).toBeVisible();
  expect(generateRequests).toHaveLength(0);

  await page.getByRole("button", { name: "Cancel" }).click();
  expect(generateRequests).toHaveLength(0);

  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "January 2026" }) })
    .getByRole("button", { name: "Generate review" })
    .click();
  await page.getByRole("button", { name: "Generate now" }).click();

  await expect.poll(() => generateRequests.length).toBe(1);
  expect(generateRequests[0]).toEqual({ monthStart: "2026-01-01" });

  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "February 2026" }) })
    .getByRole("button", { name: "Regenerate review" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Regenerate monthly review?" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This will replace the existing review text for February 2026.",
    ),
  ).toBeVisible();
  expect(generateRequests).toHaveLength(1);
});

test("opens monthly review settings from header configuration and monthly review cog", async ({
  page,
}) => {
  const promptUpdateRequests: Array<{ promptText?: string }> = [];
  let systemPromptResponse = {
    promptText: "Start with top deltas and concentration signals.",
    resolvedPrompt: "Start with top deltas and concentration signals.",
    usesDefaultPrompt: false,
  };

  await page.route("**/api/monthly-review/system-prompt", async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(systemPromptResponse),
      });
      return;
    }

    if (request.method() === "PUT") {
      const payload = request.postDataJSON() as { promptText?: string };
      promptUpdateRequests.push(payload ?? {});

      const nextPromptText = payload?.promptText ?? "";
      systemPromptResponse = {
        promptText: nextPromptText.trim().length === 0 ? "" : nextPromptText,
        resolvedPrompt:
          nextPromptText.trim().length === 0
            ? "You are a financial review assistant."
            : nextPromptText,
        usesDefaultPrompt: nextPromptText.trim().length === 0,
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(systemPromptResponse),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/monthly-review/timeline", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rows: [] }),
    });
  });

  await page.goto("/monthly-review");
  await page
    .getByRole("link", { name: "Open monthly review settings" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Monthly Review Settings" }),
  ).toBeVisible();

  const systemPromptTextbox = page.getByLabel("Monthly review system prompt");
  await expect(systemPromptTextbox).toHaveValue(
    "Start with top deltas and concentration signals.",
  );

  await systemPromptTextbox.fill("Focus on anomalies and recurring spend.");
  await page.getByRole("button", { name: "Save prompt" }).click();

  await expect.poll(() => promptUpdateRequests.length).toBe(1);
  expect(promptUpdateRequests[0]).toEqual({
    promptText: "Focus on anomalies and recurring spend.",
  });
  await expect(page.getByText("System prompt saved.")).toBeVisible();

  await page.getByRole("link", { name: "Back to monthly review" }).click();

  await expect(
    page.getByRole("heading", { name: "Monthly Review" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Configuration" }).click();
  await page
    .locator('[data-slot="navigation-menu-content"]')
    .getByRole("link", { name: /Monthly Review Settings/ })
    .click();

  await expect(
    page.getByRole("heading", { name: "Monthly Review Settings" }),
  ).toBeVisible();

  await systemPromptTextbox.fill("   ");
  await page.getByRole("button", { name: "Save prompt" }).click();

  await expect.poll(() => promptUpdateRequests.length).toBe(2);
  expect(promptUpdateRequests[1]).toEqual({
    promptText: "   ",
  });
  await expect(
    page.getByText("Using fallback default prompt for generation."),
  ).toBeVisible();
});

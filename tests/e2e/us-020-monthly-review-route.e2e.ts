import { expect, test } from "@playwright/test";

test("renders monthly review timeline cards with deterministic overview data", async ({
  page,
}) => {
  await page.route("**/api/monthly-review/timeline", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [
          {
            monthStart: "2026-04-01",
            totalSpendNok: 1850,
            totalIncomeNok: 2400,
            monthlyBalanceNok: 550,
            transactionCount: 9,
            topCategory: {
              categoryId: "cat-groceries",
              categoryName: "Groceries",
              spendNok: 820,
            },
            categorySpendBreakdown: [
              {
                categoryId: "cat-groceries",
                categoryName: "Groceries",
                spendNok: 820,
              },
            ],
            monthOverMonthSpendDeltaNok: 100,
            reviewState: "GENERATING",
            generatedAt: null,
            errorMessage: null,
          },
          {
            monthStart: "2026-03-01",
            totalSpendNok: 1725,
            totalIncomeNok: 1900,
            monthlyBalanceNok: 175,
            transactionCount: 8,
            topCategory: {
              categoryId: "cat-utilities",
              categoryName: "Utilities",
              spendNok: 760,
            },
            categorySpendBreakdown: [
              {
                categoryId: "cat-utilities",
                categoryName: "Utilities",
                spendNok: 760,
              },
            ],
            monthOverMonthSpendDeltaNok: -125,
            reviewState: "FAILED",
            generatedAt: "2026-03-28T14:00:00.000Z",
            errorMessage: "provider_error",
          },
          {
            monthStart: "2026-01-01",
            totalSpendNok: 1400,
            totalIncomeNok: 1400,
            monthlyBalanceNok: 0,
            transactionCount: 6,
            topCategory: {
              categoryId: "cat-food",
              categoryName: "Food",
              spendNok: 700,
            },
            categorySpendBreakdown: [
              {
                categoryId: "cat-food",
                categoryName: "Food",
                spendNok: 700,
              },
            ],
            monthOverMonthSpendDeltaNok: null,
            reviewState: "NOT_GENERATED",
            generatedAt: null,
            errorMessage: null,
          },
          {
            monthStart: "2026-02-01",
            totalSpendNok: 1600,
            totalIncomeNok: 3000,
            monthlyBalanceNok: 1400,
            transactionCount: 7,
            topCategory: {
              categoryId: "cat-rent",
              categoryName: "Rent",
              spendNok: 900,
            },
            categorySpendBreakdown: [
              {
                categoryId: "cat-rent",
                categoryName: "Rent",
                spendNok: 900,
              },
            ],
            monthOverMonthSpendDeltaNok: 0.4,
            reviewState: "GENERATED",
            generatedAt: "2026-02-15T10:00:00.000Z",
            errorMessage: null,
          },
        ],
      }),
    });
  });

  await page.goto("/monthly-review");

  await expect(
    page.getByRole("heading", { name: "Økonomisk tidslinje" }),
  ).toBeVisible();
  const monthHeadings = page.locator("article h2");
  await expect(monthHeadings).toHaveCount(4);
  await expect(monthHeadings.nth(0)).toHaveText("April 2026");
  await expect(monthHeadings.nth(1)).toHaveText("Mars 2026");
  await expect(monthHeadings.nth(2)).toHaveText("Februar 2026");
  await expect(monthHeadings.nth(3)).toHaveText("Januar 2026");

  await expect(page.getByText("Snittforbruk per måned").first()).toBeVisible();
  await expect(page.getByText(/1\s?600,00/).first()).toBeVisible();
  await expect(page.getByText("Månedens saldo").first()).toBeVisible();
  await expect(page.getByText("Samlet forbruk").first()).toBeVisible();
  await expect(page.getByText("Samlet inntekt").first()).toBeVisible();
  await expect(page.getByText("9 forbrukstransaksjoner")).toBeVisible();
  await expect(page.getByText("AI-innsikt")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /oppsummering/i })).toHaveCount(
    0,
  );

  const reviewStates = page
    .locator("article")
    .getByText(
      /^(Skriver oppsummering…|Oppsummering feilet|Oppsummering klar|Ingen oppsummering ennå)$/,
    );
  await expect(reviewStates).toHaveText([
    "Skriver oppsummering…",
    "Oppsummering feilet",
    "Oppsummering klar",
    "Ingen oppsummering ennå",
  ]);

  const spendChanges = page
    .locator("article")
    .getByText(/^(Forbruk (opp|ned) |Samme forbruk|Ingen forbruksdata)/);
  await expect(spendChanges).toHaveText([
    /^Forbruk opp 100,00\skr \(\+5,7\s%\)$/,
    /^Forbruk ned 125,00\skr \(−6,8\s%\)$/,
    "Samme forbruk som forrige måned",
    "Ingen forbruksdata for forrige måned",
  ]);

  const januaryLink = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Januar 2026" }) })
    .getByRole("link", { name: "Månedsrapport for januar 2026" });
  await expect(januaryLink).toHaveAttribute(
    "href",
    "/monthly-review/2026-01-01",
  );
  await expect(
    page.getByRole("link", { name: /^Månedsrapport for .+$/ }),
  ).toHaveCount(4);

  await page.route("**/api/monthly-review/2026-01-01", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        review: {
          monthStart: "2026-01-01",
          cashflow: {
            incomeNok: 1400,
            spendNok: 1400,
            netNok: 0,
            savingsRate: 0,
          },
          previousMonth: null,
          spendTransactionCount: 6,
          categories: [],
          incomeSources: [],
          bills: { totalNok: 0, count: 0, items: [] },
          everyday: {
            totalNok: 0,
            count: 0,
            topMerchants: [],
            biggestPurchase: null,
            busiestDay: null,
            dailySpend: [],
          },
          adjacentMonths: { previous: null, next: null },
          reviewState: "NOT_GENERATED",
          generatedAt: null,
          errorMessage: null,
        },
      }),
    });
  });
  await januaryLink.click();

  await expect(page).toHaveURL(/\/monthly-review\/2026-01-01$/);
  await expect(
    page.getByRole("heading", { name: "Måneden som gikk: januar 2026" }),
  ).toBeVisible();
});

test("edits monthly review settings reached from the sidebar settings link", async ({
  page,
}) => {
  const promptUpdateRequests: Array<{ promptText?: string }> = [];
  const availableModels = ["gpt-5.4-mini"];
  let systemPromptResponse = {
    promptText: "Start with top deltas and concentration signals.",
    resolvedPrompt: "Start with top deltas and concentration signals.",
    usesDefaultPrompt: false,
    modelId: "gpt-5.4-mini",
    resolvedModelId: "gpt-5.4-mini",
    usesDefaultModel: false,
    availableModels,
    availableModelsSource: "openai",
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
        modelId: "gpt-5.4-mini",
        resolvedModelId: "gpt-5.4-mini",
        usesDefaultModel: false,
        availableModels,
        availableModelsSource: "openai",
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
        availableModels,
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
  await page.getByRole("link", { name: "Innstillinger", exact: true }).click();

  await expect(page).toHaveURL(/\/settings$/);
  const monthlyReviewSection = page.getByRole("region", {
    name: "Månedsoppsummering",
  });
  await expect(
    monthlyReviewSection.getByRole("heading", { name: "Månedsoppsummering" }),
  ).toBeVisible();

  const systemPromptTextbox = page.getByLabel(
    "Systemprompt for månedsoppsummering",
  );
  await expect(systemPromptTextbox).toHaveValue(
    "Start with top deltas and concentration signals.",
  );

  await systemPromptTextbox.fill("Focus on anomalies and recurring spend.");
  await monthlyReviewSection
    .getByRole("button", { name: "Lagre prompt" })
    .click();

  await expect.poll(() => promptUpdateRequests.length).toBe(1);
  expect(promptUpdateRequests[0]).toEqual({
    promptText: "Focus on anomalies and recurring spend.",
    modelId: "gpt-5.4-mini",
  });
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Systemprompt lagret." }),
  ).toBeVisible();

  await page.reload();

  await expect(systemPromptTextbox).toHaveValue(
    "Focus on anomalies and recurring spend.",
  );

  await systemPromptTextbox.fill("   ");
  await monthlyReviewSection
    .getByRole("button", { name: "Lagre prompt" })
    .click();

  await expect.poll(() => promptUpdateRequests.length).toBe(2);
  expect(promptUpdateRequests[1]).toEqual({
    promptText: "   ",
    modelId: "gpt-5.4-mini",
  });
  await expect(
    page.getByText("Bruker standardprompten for generering."),
  ).toBeVisible();
});

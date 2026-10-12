import { expect, type Page, test } from "@playwright/test";

const MARCH_REVIEW = {
  monthStart: "2026-03-01",
  cashflow: {
    incomeNok: 25000,
    spendNok: 12500,
    netNok: 12500,
    savingsRate: 0.5,
  },
  previousMonth: {
    monthStart: "2026-02-01",
    incomeNok: 24000,
    spendNok: 13000,
    netNok: 11000,
  },
  spendTransactionCount: 9,
  categories: [
    {
      categoryId: "cat-rent",
      categoryName: "Rent",
      spendNok: 8000,
      share: 0.64,
      transactionCount: 1,
      deltaNok: 0,
    },
    {
      categoryId: "cat-food",
      categoryName: "Food",
      spendNok: 3000,
      share: 0.24,
      transactionCount: 6,
      deltaNok: -500,
    },
    {
      categoryId: "cat-travel",
      categoryName: "Travel",
      spendNok: 1500,
      share: 0.12,
      transactionCount: 2,
      deltaNok: 1500,
    },
  ],
  topMerchants: [
    { merchant: "LANDLORD", spendNok: 8000, share: 0.64, transactionCount: 1 },
    { merchant: "REMA 1000", spendNok: 2000, share: 0.16, transactionCount: 4 },
    { merchant: "VY", spendNok: 1500, share: 0.12, transactionCount: 2 },
    { merchant: "KIWI", spendNok: 1000, share: 0.08, transactionCount: 2 },
  ],
  incomeSources: [{ source: "EMPLOYER", amountNok: 25000 }],
  biggestPurchase: {
    bookingDate: "2026-03-01",
    merchant: "LANDLORD",
    amountNok: 8000,
    categoryName: "Rent",
  },
  busiestDay: {
    bookingDate: "2026-03-14",
    spendNok: 1800,
    transactionCount: 3,
  },
  reviewState: "NOT_GENERATED",
  generatedAt: null,
  errorMessage: null,
  reviewText: null,
};

async function stubReview(page: Page, review: () => object) {
  await page.route("**/api/monthly-review/2026-03-01", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ review: review() }),
    });
  });
}

function activeSlide(page: Page) {
  return page.locator('section[aria-roledescription="slide"]');
}

test("navigates month in review slides by buttons, keyboard, and progress bar", async ({
  page,
}) => {
  await stubReview(page, () => MARCH_REVIEW);

  await page.goto("/monthly-review/2026-03-01");

  await expect(
    page.getByRole("heading", { name: "March 2026 in review" }),
  ).toBeVisible();
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "1 of 7: Intro",
  );
  await expect(page.getByText("9 purchases")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "2 of 7: Net result",
  );
  await expect(page.getByTestId("net-result")).toHaveText(/^\+12\s500,00\skr$/);
  await expect(activeSlide(page).getByText(/^\+25\s000,00\skr$/)).toHaveCount(
    2,
  );
  await expect(activeSlide(page).getByText(/^-12\s500,00\skr$/)).toBeVisible();
  await expect(page.getByText("You kept 50% of your income.")).toBeVisible();
  await expect(page.getByText("vs February 2026")).toBeVisible();
  await expect(activeSlide(page).getByText(/^\+1\s500,00\skr$/)).toBeVisible();
  await expect(activeSlide(page).getByText("EMPLOYER")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "3 of 7: Where it went",
  );
  await expect(
    page.getByRole("heading", { name: "Rent took 64% of your spending." }),
  ).toBeVisible();
  await expect(page.getByText(/^-500,00\skr vs last month$/)).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "2 of 7: Net result",
  );

  await page.getByRole("button", { name: "Go to slide 7: Summary" }).click();
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "7 of 7: Summary",
  );
  await expect(
    page.getByRole("heading", { name: "March 2026 at a glance." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "6 of 7: AI recap",
  );

  await page.getByRole("link", { name: "Back to timeline" }).click();
  await expect(page).toHaveURL(/\/monthly-review$/);
});

test("drops slides that have no data", async ({ page }) => {
  await stubReview(page, () => ({
    ...MARCH_REVIEW,
    cashflow: { incomeNok: 0, spendNok: 0, netNok: 0, savingsRate: null },
    previousMonth: null,
    spendTransactionCount: 0,
    categories: [],
    topMerchants: [],
    incomeSources: [],
    biggestPurchase: null,
    busiestDay: null,
  }));

  await page.goto("/monthly-review/2026-03-01");

  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "1 of 3: Intro",
  );
  await page.keyboard.press("ArrowRight");
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "2 of 3: AI recap",
  );
});

test("generates the AI recap after confirmation", async ({ page }) => {
  const generateRequests: Array<{ monthStart?: string }> = [];
  let releaseGeneration: () => void = () => {};
  const generationReleased = new Promise<void>((resolve) => {
    releaseGeneration = resolve;
  });
  let review: object = MARCH_REVIEW;

  await stubReview(page, () => review);
  await page.route("**/api/monthly-review/generate", async (route) => {
    generateRequests.push(route.request().postDataJSON() ?? {});
    await generationReleased;
    review = {
      ...MARCH_REVIEW,
      reviewState: "GENERATED",
      generatedAt: "2026-04-02T09:30:00.000Z",
      reviewText: "Mars endte med et overskudd på 12 500 kr.",
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        monthStart: "2026-03-01",
        status: "GENERATED",
        generatedAt: "2026-04-02T09:30:00.000Z",
        errorMessage: null,
        reviewText: "Mars endte med et overskudd på 12 500 kr.",
        unavailableReason: null,
      }),
    });
  });

  await page.goto("/monthly-review/2026-03-01");
  await page.getByRole("button", { name: "Go to slide 6: AI recap" }).click();

  await page.getByRole("button", { name: "Generate review" }).click();
  await expect(
    page.getByRole("heading", { name: "Generate monthly review?" }),
  ).toBeVisible();
  await expect(
    page.getByText("This will generate a monthly AI review for March 2026."),
  ).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "6 of 7: AI recap",
  );
  expect(generateRequests).toHaveLength(0);

  await page.getByRole("button", { name: "Generate review" }).click();
  await page.getByRole("button", { name: "Generate now" }).click();

  await expect(page.getByText("Writing your recap...")).toBeVisible();
  await expect.poll(() => generateRequests.length).toBe(1);
  expect(generateRequests[0]).toEqual({ monthStart: "2026-03-01" });

  releaseGeneration();

  await expect(
    page.getByText("Mars endte med et overskudd på 12 500 kr."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Regenerate review" }),
  ).toBeVisible();
});

test("shows a failed AI recap with a regenerate action", async ({ page }) => {
  const generateRequests: Array<{ monthStart?: string }> = [];

  await stubReview(page, () => ({
    ...MARCH_REVIEW,
    reviewState: "FAILED",
    errorMessage: "provider_error",
  }));
  await page.route("**/api/monthly-review/generate", async (route) => {
    generateRequests.push(route.request().postDataJSON() ?? {});
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "MONTHLY_REVIEW_GENERATION_FAILED" }),
    });
  });

  await page.goto("/monthly-review/2026-03-01");
  await page.getByRole("button", { name: "Go to slide 6: AI recap" }).click();

  await expect(
    page.getByText("Generation failed: provider_error"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Regenerate review" }).click();
  await expect(
    page.getByRole("heading", { name: "Regenerate monthly review?" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This will replace the existing review text for March 2026.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Regenerate now" }).click();

  await expect.poll(() => generateRequests.length).toBe(1);
  await expect(
    page.getByText(
      "Could not start monthly review generation. Please try again.",
    ),
  ).toBeVisible();
});

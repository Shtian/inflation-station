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
            reviewText: "Spending increased due to rent and utilities.",
          },
        ],
      }),
    });
  });

  await page.goto("/monthly-review");

  await expect(
    page.getByRole("heading", { name: "Monthly Review" }),
  ).toBeVisible();

  const monthHeadings = page.locator("article h2");
  await expect(monthHeadings).toHaveCount(2);
  await expect(monthHeadings.nth(0)).toHaveText("February 2026");
  await expect(monthHeadings.nth(1)).toHaveText("January 2026");

  await expect(page.getByText("Total spend").first()).toBeVisible();
  await expect(page.getByText(/1\s?600,00/).first()).toBeVisible();
  await expect(page.getByText("Transactions").first()).toBeVisible();
  await expect(page.getByText("7").first()).toBeVisible();
  await expect(page.getByText(/Rent \(/)).toBeVisible();

  await expect(
    page.getByText("No review generated for this month yet."),
  ).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("updates dashboard charts when account and date filters change", async ({
  page,
}) => {
  let savingsAccountRequestCount = 0;

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
          {
            id: "acc-2",
            name: "Savings Account",
            institution: "Nordea",
            isActive: true,
          },
        ],
      }),
    });
  });

  await page.route("**/api/dashboard/analytics**", async (route, request) => {
    const url = new URL(request.url());
    const accountId = url.searchParams.get("accountId");

    if (accountId === "acc-2") {
      savingsAccountRequestCount += 1;
    }

    if (accountId === "acc-2" && savingsAccountRequestCount >= 2) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          filters: {
            accountId: "acc-2",
            startDate: "2026-01-10",
            endDate: "2026-01-25",
          },
          netCashflow: [{ date: "2026-01-20", netNok: -140 }],
          inflowOutflow: [
            { date: "2026-01-20", inflowNok: 0, outflowNok: 140 },
          ],
          categoryBreakdown: [
            {
              categoryId: "cat-utilities",
              categoryName: "Utilities",
              spendNok: 140,
              transactionCount: 1,
            },
          ],
          accountTrend: [
            {
              accountId: "acc-2",
              accountName: "Savings Account",
              points: [
                { date: "2026-01-20", netNok: -140, cumulativeNok: 960 },
              ],
            },
          ],
        }),
      });
      return;
    }

    if (accountId === "acc-2") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          filters: {
            accountId: "acc-2",
            startDate: "2026-01-01",
            endDate: "2026-01-31",
          },
          netCashflow: [{ date: "2026-01-15", netNok: 500 }],
          inflowOutflow: [
            { date: "2026-01-15", inflowNok: 500, outflowNok: 0 },
          ],
          categoryBreakdown: [],
          accountTrend: [
            {
              accountId: "acc-2",
              accountName: "Savings Account",
              points: [
                { date: "2026-01-15", netNok: 500, cumulativeNok: 1100 },
              ],
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        filters: {
          accountId: null,
          startDate: "2026-01-01",
          endDate: "2026-01-31",
        },
        netCashflow: [{ date: "2026-01-02", netNok: 200 }],
        inflowOutflow: [
          { date: "2026-01-02", inflowNok: 300, outflowNok: 100 },
        ],
        categoryBreakdown: [
          {
            categoryId: "cat-food",
            categoryName: "Food",
            spendNok: 100,
            transactionCount: 1,
          },
        ],
        accountTrend: [
          {
            accountId: "acc-1",
            accountName: "Main Account",
            points: [{ date: "2026-01-02", netNok: 200, cumulativeNok: 200 }],
          },
        ],
      }),
    });
  });

  await page.goto("/overview");

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Net Cashflow" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Inflow vs Outflow" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Category Spend Breakdown" }),
  ).toBeVisible();
    await expect(
    page.getByRole("heading", { name: "Account State Trend" }),
  ).toBeVisible();
  await expect(page.locator("[data-slot='chart']")).toHaveCount(4);
  await expect(page.getByText(/200,00/).first()).toBeVisible();
  await expect(page.getByText(/Food:\s/)).toBeVisible();

  await page.getByRole("combobox", { name: "Account filter" }).click();
  await page
    .getByRole("option", { name: "Savings Account", exact: true })
    .click();
  await expect(page.getByText(/1\s?100,00/)).toBeVisible();

  await page.getByRole("button", { name: "Year to date" }).click();
  await expect(page.getByRole("button", { name: "Year to date" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText(/960,00/).first()).toBeVisible();
  await expect(page.getByText(/Utilities:\s/)).toBeVisible();
});

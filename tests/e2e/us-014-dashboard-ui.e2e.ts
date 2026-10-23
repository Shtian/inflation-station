import { expect, type Page, test } from "@playwright/test";

const MONTH_NAMES = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

function toIsoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthOf(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  return {
    year: first.getFullYear(),
    name: `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`,
    param: toIsoDate(first).slice(0, 7),
    range: {
      startDate: toIsoDate(first),
      endDate: toIsoDate(
        new Date(first.getFullYear(), first.getMonth() + 1, 0),
      ),
    },
  };
}

async function stubDashboard(page: Page) {
  const requestedRanges: Array<{
    startDate: string | null;
    endDate: string | null;
  }> = [];

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
        ],
      }),
    });
  });

  await page.route("**/api/dashboard/analytics**", async (route, request) => {
    const url = new URL(request.url());
    requestedRanges.push({
      startDate: url.searchParams.get("startDate"),
      endDate: url.searchParams.get("endDate"),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        netCashflow: [],
        inflowOutflow: [],
        categoryBreakdown: [],
        accountTrend: [],
      }),
    });
  });

  return { lastRange: () => requestedRanges.at(-1) };
}

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

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Oversikt" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Forbruk per kategori" }),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: /Food/ })).toBeVisible();

  await page.getByRole("tab", { name: "Flyt", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Netto kontantstrøm" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inn og ut" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kontoutvikling" }),
  ).toBeVisible();
  await expect(page.locator("[data-slot='chart']")).toHaveCount(3);
  const flowLegend = page.locator(".recharts-default-legend").first();
  await expect(flowLegend.getByText("Inn", { exact: true })).toBeVisible();
  await expect(flowLegend.getByText("Ut", { exact: true })).toBeVisible();
  await expect(page.getByText(/200,00/).first()).toBeVisible();

  await page.getByRole("combobox", { name: "Kontofilter" }).click();
  await page
    .getByRole("option", { name: "Savings Account", exact: true })
    .click();
  await expect(page.getByText(/1\s?100,00/)).toBeVisible();

  await page.getByRole("button", { name: "Annen periode" }).click();
  await page.getByRole("button", { name: "Hittil i år" }).click();
  await expect(page.getByRole("button", { name: "Annen periode" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Hittil i år", expanded: false }),
  ).toBeVisible();
  await expect(page.getByText(/960,00/).first()).toBeVisible();
  await page.getByRole("tab", { name: "Kategori", exact: true }).click();
  await expect(page.getByRole("row", { name: /Utilities/ })).toBeVisible();
});

test("hides a category from the totals and shows it again", async ({
  page,
}) => {
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
        ],
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
        categoryBreakdown: [
          {
            categoryId: "cat-car",
            categoryName: "Car",
            spendNok: 6000,
            transactionCount: 1,
          },
          {
            categoryId: "cat-food",
            categoryName: "Food",
            spendNok: 3000,
            transactionCount: 12,
          },
          {
            categoryId: "cat-transport",
            categoryName: "Transport",
            spendNok: 1000,
            transactionCount: 4,
          },
        ],
        accountTrend: [],
      }),
    });
  });

  await page.goto("/");

  const carRow = page.getByRole("row", { name: /Car/ });
  await expect(page.getByText(/10\s000\skr brukt i perioden/)).toBeVisible();
  await expect(carRow).toBeVisible();

  await carRow.hover();
  await page.getByRole("button", { name: "Skjul Car" }).click();

  await expect(carRow).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Vis Car" })).toBeVisible();
  await expect(page.getByText(/4\s000\skr brukt i perioden/)).toBeVisible();
  await expect(
    page.getByText(/1 kategori skjult \(6\s000\skr\)/),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: /Food.*75\s%/ })).toBeVisible();

  await page.getByRole("button", { name: "Vis Car" }).click();

  await expect(carRow).toBeVisible();
  await expect(page.getByRole("button", { name: "Vis Car" })).toHaveCount(0);
  await expect(page.getByText(/10\s000\skr brukt i perioden/)).toBeVisible();

  await page.getByRole("button", { name: "Andelskart" }).click();
  await page.getByRole("button", { name: "Skjul Transport" }).click();

  await expect(
    page.getByRole("button", { name: "Skjul Transport" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/1 kategori skjult \(1\s000\skr\)/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Vis alle" }).click();

  await expect(
    page.getByRole("button", { name: "Skjul Transport" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Vis alle" })).toHaveCount(0);
});

test("selects a dashboard month by year and keeps it in the URL", async ({
  page,
}) => {
  const now = new Date();
  const previous = monthOf(now.getFullYear(), now.getMonth() - 1);
  const marchYearBefore = monthOf(previous.year - 1, 2);
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  const dashboard = await stubDashboard(page);

  await page.goto("/");

  await expect.poll(dashboard.lastRange).toEqual(previous.range);
  await expect(
    page.getByRole("button", { name: previous.name, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "År" })).toContainText(
    String(previous.year),
  );

  await page.getByRole("button", { name: "Forrige år" }).click();
  await expect(page.getByRole("group", { name: "År" })).toContainText(
    String(previous.year - 1),
  );
  await page
    .getByRole("button", { name: marchYearBefore.name, exact: true })
    .click();

  await expect.poll(dashboard.lastRange).toEqual(marchYearBefore.range);
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("period") === marchYearBefore.param,
  );

  await page.reload();

  await expect.poll(dashboard.lastRange).toEqual(marchYearBefore.range);
  await expect(
    page.getByRole("button", { name: marchYearBefore.name, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Annen periode" }).click();
  await page.getByRole("button", { name: "Egendefinert…" }).click();
  await expect(page.getByRole("grid")).toHaveCount(2);

  const marchYear = marchYearBefore.year;
  await page
    .getByRole("button", { name: new RegExp(`\\b5\\. mars ${marchYear}$`) })
    .click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("period") ===
      `${marchYear}-03-05..${marchYear}-03-05`,
  );
  await expect(page.getByRole("grid")).toHaveCount(2);

  await page
    .getByRole("button", { name: new RegExp(`\\b18\\. mars ${marchYear}$`) })
    .click();
  await expect.poll(dashboard.lastRange).toEqual({
    startDate: `${marchYear}-03-05`,
    endDate: `${marchYear}-03-18`,
  });
  await expect(page.getByRole("grid")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Egendefinert", expanded: false }),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("falls back to the previous month for an invalid period param", async ({
  page,
}) => {
  const now = new Date();
  const previous = monthOf(now.getFullYear(), now.getMonth() - 1);
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  const dashboard = await stubDashboard(page);

  await page.goto("/?period=garbage");

  await expect(page.getByRole("heading", { name: "Oversikt" })).toBeVisible();
  await expect.poll(dashboard.lastRange).toEqual(previous.range);
  await expect(
    page.getByRole("button", { name: previous.name, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

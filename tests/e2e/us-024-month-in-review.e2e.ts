import { expect, type Page, test } from "@playwright/test";
import type { MonthInReviewWithReview } from "@/lib/monthly-review/month-in-review";

function marchDailySpend(
  byDate: Record<string, { spendNok: number; transactionCount: number }>,
) {
  return Array.from({ length: 31 }, (_, index) => {
    const date = `2026-03-${`${index + 1}`.padStart(2, "0")}`;
    return { date, ...(byDate[date] ?? { spendNok: 0, transactionCount: 0 }) };
  });
}

const EMPTY_EVERYDAY: MonthInReviewWithReview["everyday"] = {
  totalNok: 0,
  count: 0,
  topMerchants: [],
  biggestPurchase: null,
  busiestDay: null,
  dailySpend: marchDailySpend({}),
};

const MARCH_REVIEW: MonthInReviewWithReview = {
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
  incomeSources: [{ source: "EMPLOYER", amountNok: 25000 }],
  bills: {
    totalNok: 8000,
    count: 1,
    items: [{ merchant: "LANDLORD", categoryName: "Rent", amountNok: 8000 }],
  },
  everyday: {
    totalNok: 4500,
    count: 8,
    topMerchants: [
      {
        merchant: "REMA 1000",
        spendNok: 2000,
        share: 2000 / 4500,
        transactionCount: 4,
      },
      {
        merchant: "VY",
        spendNok: 1500,
        share: 1500 / 4500,
        transactionCount: 2,
      },
      {
        merchant: "KIWI",
        spendNok: 1000,
        share: 1000 / 4500,
        transactionCount: 2,
      },
    ],
    biggestPurchase: {
      bookingDate: "2026-03-08",
      merchant: "VY",
      amountNok: 900,
      categoryName: "Travel",
    },
    busiestDay: {
      bookingDate: "2026-03-14",
      spendNok: 1800,
      transactionCount: 3,
    },
    dailySpend: marchDailySpend({
      "2026-03-02": { spendNok: 400, transactionCount: 1 },
      "2026-03-05": { spendNok: 300, transactionCount: 1 },
      "2026-03-08": { spendNok: 900, transactionCount: 1 },
      "2026-03-14": { spendNok: 1800, transactionCount: 3 },
      "2026-03-20": { spendNok: 600, transactionCount: 1 },
      "2026-03-27": { spendNok: 500, transactionCount: 1 },
    }),
  },
  adjacentMonths: { previous: "2026-02-01", next: null },
  reviewState: "NOT_GENERATED",
  generatedAt: null,
  errorMessage: null,
  recap: null,
};

async function stubReview(page: Page, review: () => MonthInReviewWithReview) {
  await page.route("**/api/monthly-review/2026-03-01", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ review: review() }),
    });
  });
}

function activeSlide(page: Page) {
  return page.locator('section[aria-roledescription="lysbilde"]');
}

const EMPTY_MONTH: MonthInReviewWithReview = {
  ...MARCH_REVIEW,
  cashflow: { incomeNok: 0, spendNok: 0, netNok: 0, savingsRate: null },
  previousMonth: null,
  spendTransactionCount: 0,
  categories: [],
  incomeSources: [],
  bills: { totalNok: 0, count: 0, items: [] },
  everyday: EMPTY_EVERYDAY,
};

test("steps through every slide by buttons and keyboard, keeping the slide in the URL", async ({
  page,
}) => {
  await stubReview(page, () => MARCH_REVIEW);

  await page.goto("/monthly-review/2026-03-01");

  await expect(
    page.getByRole("heading", { name: "Måneden som gikk: Mars 2026" }),
  ).toBeAttached();
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "1 av 7: Intro",
  );
  await expect(
    activeSlide(page).getByText(
      /^Du beholdt 12\s500\skr av det som kom inn\. La oss se hvor resten ble av\.$/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Forrige", exact: true }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "2 av 7: Nettoresultat",
  );
  await expect(page).toHaveURL(/\/monthly-review\/2026-03-01\?slide=net$/);
  await expect(page.getByTestId("net-result")).toHaveText(/^\+12\s500\skr$/);
  await expect(
    page.getByText(/Du beholdt 50\s%\sav inntekten din\./),
  ).toBeVisible();
  await expect(
    activeSlide(page).getByText(/^1\s500\skr bedre enn i februar\.$/),
  ).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "3 av 7: Hvor pengene gikk",
  );
  await expect(
    page.getByRole("heading", {
      name: /^Rent utgjorde 64\s%\sav forbruket ditt\.$/,
    }),
  ).toBeVisible();
  const rentRow = activeSlide(page).getByRole("link", { name: /^Rent/ });
  await expect(rentRow).toHaveAttribute(
    "href",
    "/transactions?dateFrom=2026-03-01&dateTo=2026-03-31&categoryId=cat-rent",
  );
  await expect(rentRow).not.toContainText(/mer|mindre/);
  await expect(
    activeSlide(page).getByRole("link", { name: /^Food/ }),
  ).toContainText(/500\skr mindre/);
  await expect(
    activeSlide(page).getByRole("link", { name: /^Travel/ }),
  ).toContainText(/1\s500\skr mer/);

  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", {
      name: /^Regningene gikk som smurt: 8\s000\skr\.$/,
    }),
  ).toBeVisible();
  await expect(activeSlide(page).getByText("LANDLORD")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", {
      name: /^REMA 1000\s*2\s000\skr, 4\skjøp$/,
    }),
  ).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: /^VY, 900\skr, søndag 8\.\smars$/ }),
  ).toBeVisible();
  await expect(
    activeSlide(page).getByText(
      /^Flest kjøp: lørdag 14\.\smars, 3\skjøp for 1\s800\skr\.$/,
    ),
  ).toBeVisible();

  await page.keyboard.press("Home");
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "1 av 7: Intro",
  );
  await page.keyboard.press("End");
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "7 av 7: Finale",
  );
  await expect(
    page.getByRole("button", { name: "Neste", exact: true }),
  ).toBeDisabled();

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/monthly-review$/);
});

test("opens the slide named in the URL and jumps with the progress bar", async ({
  page,
}) => {
  await stubReview(page, () => MARCH_REVIEW);

  await page.goto("/monthly-review/2026-03-01?slide=bills");
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "4 av 7: Regninger",
  );

  await page
    .getByRole("button", { name: "Gå til lysbilde 6: Øyeblikk" })
    .click();
  await expect(page).toHaveURL(/\?slide=moments$/);
  await page.reload();
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "6 av 7: Øyeblikk",
  );
});

test("ends on a finale with real exits", async ({ page }) => {
  await stubReview(page, () => ({
    ...MARCH_REVIEW,
    adjacentMonths: { previous: "2026-02-01", next: "2026-04-01" },
  }));

  await page.goto("/monthly-review/2026-03-01?slide=finale");

  await expect(
    page.getByRole("heading", { name: /^Netto \+12\s500\skr$/ }),
  ).toBeVisible();
  await expect(
    activeSlide(page).getByText(/^25\s000\skr inn, 12\s500\skr ut\.$/),
  ).toBeVisible();
  await expect(
    activeSlide(page).getByText(
      /^8\s000\skr i regninger, 4\s500\skr i hverdagskjøp\.$/,
    ),
  ).toBeVisible();

  const exits = page.getByRole("navigation", { name: "Forlat oppsummeringen" });
  await expect(
    exits.getByRole("link", { name: "Februar 2026" }),
  ).toHaveAttribute("href", "/monthly-review/2026-02-01");
  await expect(exits.getByRole("link", { name: "April 2026" })).toHaveAttribute(
    "href",
    "/monthly-review/2026-04-01",
  );
  await expect(
    exits.getByRole("link", { name: "Se transaksjoner" }),
  ).toHaveAttribute(
    "href",
    "/transactions?dateFrom=2026-03-01&dateTo=2026-03-31",
  );

  await exits.getByRole("button", { name: "Spill av igjen" }).click();
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "1 av 7: Intro",
  );
  await expect(page).toHaveURL(/\?slide=intro$/);
});

test("omits a month exit when there is no month on that side", async ({
  page,
}) => {
  await stubReview(page, () => MARCH_REVIEW);

  await page.goto("/monthly-review/2026-03-01?slide=finale");

  const exits = page.getByRole("navigation", { name: "Forlat oppsummeringen" });
  await expect(exits.getByRole("link")).toHaveText([
    "Februar 2026",
    "Se transaksjoner",
  ]);
});

test("says once that every category held steady instead of repeating it per row", async ({
  page,
}) => {
  await stubReview(page, () => ({
    ...MARCH_REVIEW,
    categories: MARCH_REVIEW.categories.map((category) => ({
      ...category,
      deltaNok: 0.4,
    })),
  }));

  await page.goto("/monthly-review/2026-03-01?slide=categories");

  await expect(
    activeSlide(page).getByText(
      "Alle kategorier holdt seg på samme nivå som i februar.",
    ),
  ).toBeVisible();
  await expect(activeSlide(page).getByText(/ (mer|mindre)$/)).toHaveCount(0);
});

test("an empty month keeps only the intro and finale, with no recap offer", async ({
  page,
}) => {
  await stubReview(page, () => EMPTY_MONTH);

  await page.goto("/monthly-review/2026-03-01");

  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "1 av 2: Intro",
  );
  await expect(
    page.getByText("En rolig måned uten registrert forbruk eller inntekt."),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "2 av 2: Finale",
  );
  await expect(page.getByRole("heading", { name: "Netto 0 kr" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Skriv en oppsummering" }),
  ).toHaveCount(0);
});

test("writes the recap after confirmation and opens with it next time", async ({
  page,
}) => {
  const generateRequests: Array<{ monthStart?: string }> = [];
  let releaseGeneration: () => void = () => {};
  const generationReleased = new Promise<void>((resolve) => {
    releaseGeneration = resolve;
  });
  let review = MARCH_REVIEW;

  await stubReview(page, () => review);
  await page.route("**/api/monthly-review/generate", async (route) => {
    generateRequests.push(route.request().postDataJSON() ?? {});
    await generationReleased;
    review = {
      ...MARCH_REVIEW,
      reviewState: "GENERATED",
      generatedAt: "2026-04-02T09:30:00.000Z",
      recap: {
        headline: "Mars endte med et overskudd på 12 500 kr.",
        points: [
          "Regningene utgjorde 8 400 kr i faste kostnader.",
          "Mat gikk ned med 1 200 kr fra februar.",
          "Sett av overskuddet til sparing tidlig i april.",
        ],
      },
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        monthStart: "2026-03-01",
        status: "GENERATED",
        generatedAt: "2026-04-02T09:30:00.000Z",
        errorMessage: null,
        recap: review.recap,
        unavailableReason: null,
      }),
    });
  });

  await page.goto("/monthly-review/2026-03-01?slide=finale");

  await page.getByRole("button", { name: "Skriv en oppsummering" }).click();
  await expect(
    page.getByRole("heading", { name: "Skrive en oppsummering?" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Avbryt" }).click();
  await expect(activeSlide(page)).toHaveAttribute(
    "aria-label",
    "7 av 7: Finale",
  );
  expect(generateRequests).toHaveLength(0);

  await page.getByRole("button", { name: "Skriv en oppsummering" }).click();
  await page.getByRole("button", { name: "Skriv den" }).click();

  await expect(page.getByText("Skriver oppsummeringen…")).toBeVisible();
  await expect.poll(() => generateRequests.length).toBe(1);
  expect(generateRequests[0]).toEqual({ monthStart: "2026-03-01" });

  releaseGeneration();

  const finale = activeSlide(page);
  await expect(
    finale.getByText(/^Mars endte med et overskudd på 12\s500\skr\.$/),
  ).toBeVisible();
  await expect(finale.getByRole("listitem")).toContainText([
    /^Regningene utgjorde 8\s400\skr i faste kostnader\.$/,
    /^Mat gikk ned med 1\s200\skr fra februar\.$/,
    "Sett av overskuddet til sparing tidlig i april.",
  ]);
  await expect(
    page.getByRole("button", { name: "Skriv oppsummeringen på nytt" }),
  ).toBeVisible();

  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.keyboard.press("Home");
  await expect(
    activeSlide(page).getByText(
      /^Mars endte med et overskudd på 12\s500\skr\.$/,
    ),
  ).toBeVisible();
});

test("a failed recap says so plainly and offers a retry", async ({ page }) => {
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

  await page.goto("/monthly-review/2026-03-01?slide=finale");

  await expect(
    page.getByText("Oppsummeringen kunne ikke skrives. Prøv igjen."),
  ).toBeVisible();
  await expect(page.getByText("provider_error")).toHaveCount(0);

  await page.getByRole("button", { name: "Prøv igjen" }).click();
  await expect(
    page.getByRole("heading", { name: "Skrive oppsummeringen på nytt?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Skriv på nytt", exact: true })
    .click();

  await expect.poll(() => generateRequests.length).toBe(1);
  await expect(
    page.getByText("Oppsummeringen kunne ikke skrives. Prøv igjen."),
  ).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("taps the side thirds and swipes to step", async ({ page }) => {
    await stubReview(page, () => MARCH_REVIEW);
    await page.goto("/monthly-review/2026-03-01");
    await expect(activeSlide(page)).toHaveAttribute(
      "aria-label",
      "1 av 7: Intro",
    );

    await page.touchscreen.tap(350, 420);
    await expect(activeSlide(page)).toHaveAttribute(
      "aria-label",
      "2 av 7: Nettoresultat",
    );
    await page.touchscreen.tap(40, 420);
    await expect(activeSlide(page)).toHaveAttribute(
      "aria-label",
      "1 av 7: Intro",
    );

    await activeSlide(page).evaluate((slide) => {
      const touch = (type: string, clientX: number) =>
        slide.dispatchEvent(
          new PointerEvent(type, {
            pointerType: "touch",
            clientX,
            clientY: 420,
            bubbles: true,
          }),
        );
      touch("pointerdown", 300);
      touch("pointerup", 120);
    });
    await expect(activeSlide(page)).toHaveAttribute(
      "aria-label",
      "2 av 7: Nettoresultat",
    );
  });
});

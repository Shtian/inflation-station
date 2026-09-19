import { expect, type Page, test } from "@playwright/test";

async function stubAccountsAndCategories(page: Page): Promise<void> {
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
  await page.route("**/api/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        categories: [
          { id: "cat-groceries", name: "Groceries" },
          { id: "cat-transport", name: "Transport" },
        ],
      }),
    });
  });
}

const reviewRows = [
  {
    id: "row-1",
    rowNumber: 2,
    bookingDate: "2026-01-01",
    amountNok: -100,
    currency: "NOK",
    normalizedMerchant: "high confidence merchant",
    paymentType: "CARD",
    name: "high confidence merchant",
    title: "HIGH CONFIDENCE MERCHANT",
    categoryId: "cat-groceries",
    potentialDuplicate: false,
    suggestionSource: "JEV",
    suggestionConfidence: 0.9,
  },
  {
    id: "row-2",
    rowNumber: 3,
    bookingDate: "2026-01-02",
    amountNok: -50,
    currency: "NOK",
    normalizedMerchant: "medium confidence merchant",
    paymentType: "CARD",
    name: "medium confidence merchant",
    title: "MEDIUM CONFIDENCE MERCHANT",
    categoryId: "cat-transport",
    potentialDuplicate: false,
    suggestionSource: "JEV",
    suggestionConfidence: 0.5,
  },
  {
    id: "row-3",
    rowNumber: 4,
    bookingDate: "2026-01-03",
    amountNok: -75,
    currency: "NOK",
    normalizedMerchant: "low confidence merchant",
    paymentType: "CARD",
    name: "low confidence merchant",
    title: "LOW CONFIDENCE MERCHANT",
    categoryId: "cat-groceries",
    potentialDuplicate: false,
    suggestionSource: "JEV",
    suggestionConfidence: 0.15,
  },
  {
    id: "row-4",
    rowNumber: 5,
    bookingDate: "2026-01-04",
    amountNok: -20,
    currency: "NOK",
    normalizedMerchant: "sub floor merchant",
    paymentType: "CARD",
    name: "sub floor merchant",
    title: "SUB FLOOR MERCHANT",
    categoryId: null,
    potentialDuplicate: false,
    suggestionSource: null,
    suggestionConfidence: null,
  },
  {
    id: "row-5",
    rowNumber: 6,
    bookingDate: "2026-01-05",
    amountNok: -30,
    currency: "NOK",
    normalizedMerchant: "rule matched merchant",
    paymentType: "CARD",
    name: "rule matched merchant",
    title: "RULE MATCHED MERCHANT",
    categoryId: "cat-groceries",
    potentialDuplicate: false,
    suggestionSource: "RULE",
    suggestionConfidence: 0.95,
  },
];

async function stubParse(page: Page) {
  await page.route("**/api/imports/parse", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        detection: {
          state: "certain",
          providerId: "provider-1",
          providerName: "DNB",
          score: 1,
          matchedHeaders: ["bokforingsdato", "belop"],
          candidates: [],
        },
        summary: {
          imported: reviewRows.length,
          duplicates: 0,
          ignoredReserved: 0,
          invalid: 0,
        },
        errors: [],
        review: {
          sessionId: "session-1",
          potentialDuplicates: 0,
          rows: reviewRows,
        },
        cleanup: {
          status: "unavailable",
          reason: "disabled",
          rowIds: reviewRows.map((row) => row.id),
        },
      }),
    });
  });
}

test("colors the certainty bar by Jev confidence tier and hides it for suppressed or rule-matched rows", async ({
  page,
}) => {
  await stubAccountsAndCategories(page);
  await stubParse(page);

  await page.goto("/import");
  await page.getByRole("button", { name: "Main Account DNB" }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;100,00", "utf8"),
  });
  await page.getByRole("button", { name: /Parse/ }).click();
  await expect(page.getByText("Import Preview")).toBeVisible();

  const highBar = page.getByRole("img", {
    name: /AI suggestion confidence for row 2: high/i,
  });
  await expect(highBar).toBeVisible();
  await expect(highBar.locator("span")).toHaveClass(/bg-success/);
  await expect(highBar.locator("span")).toHaveAttribute(
    "style",
    /height:\s*90%/,
  );

  const mediumBar = page.getByRole("img", {
    name: /AI suggestion confidence for row 3: medium/i,
  });
  await expect(mediumBar).toBeVisible();
  await expect(mediumBar.locator("span")).toHaveClass(/bg-warning/);
  await expect(mediumBar.locator("span")).toHaveAttribute(
    "style",
    /height:\s*50%/,
  );

  const lowBar = page.getByRole("img", {
    name: /AI suggestion confidence for row 4: low/i,
  });
  await expect(lowBar).toBeVisible();
  await expect(lowBar.locator("span")).toHaveClass(/bg-destructive/);
  await expect(lowBar.locator("span")).toHaveAttribute(
    "style",
    /height:\s*15%/,
  );

  await expect(
    page.getByRole("img", { name: /confidence for row 5/i }),
  ).toHaveCount(0);
  const subFloorCategory = page.getByRole("combobox", {
    name: "Category for row 5",
  });
  await expect(subFloorCategory).toHaveValue("");
  await expect(subFloorCategory).toHaveAttribute(
    "placeholder",
    "Uncategorized",
  );

  await expect(
    page.getByRole("img", { name: /confidence for row 6/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Category for row 6" }),
  ).toHaveValue("Groceries");
});

test("hides the certainty bar the instant the row's category is changed away from the suggestion", async ({
  page,
}) => {
  await stubAccountsAndCategories(page);
  await stubParse(page);

  await page.goto("/import");
  await page.getByRole("button", { name: "Main Account DNB" }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;100,00", "utf8"),
  });
  await page.getByRole("button", { name: /Parse/ }).click();
  await expect(page.getByText("Import Preview")).toBeVisible();

  const highBar = page.getByRole("img", {
    name: /AI suggestion confidence for row 2: high/i,
  });
  await expect(highBar).toBeVisible();

  const rowTwoCategory = page.getByRole("combobox", {
    name: "Category for row 2",
  });
  await rowTwoCategory.click();
  await page.getByRole("option", { name: "Transport", exact: true }).click();
  await expect(rowTwoCategory).toHaveValue("Transport");

  await expect(highBar).toHaveCount(0);
});

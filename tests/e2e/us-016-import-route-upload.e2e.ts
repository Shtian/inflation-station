import { expect, test } from "@playwright/test";

test("parses CSV uploads from /import and shows validation feedback", async ({
  page,
}) => {
  let submitRequestBody: unknown = null;

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

  await page.route("**/api/imports/parse", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          imported: 2,
          duplicates: 0,
          ignoredReserved: 1,
          invalid: 1,
        },
        errors: [
          {
            rowNumber: 4,
            code: "INVALID_AMOUNT",
            message:
              'Row 4 has invalid amount "abc". Expected Norwegian decimal format like 123,45.',
          },
        ],
        review: {
          sessionId: "session-1",
          potentialDuplicates: 1,
          rows: [
            {
              id: "row-1",
              rowNumber: 2,
              bookingDate: "2026-01-01",
              amountNok: -123.45,
              currency: "NOK",
              normalizedMerchant: "joker",
              paymentType: "CARD",
              categoryId: null,
              potentialDuplicate: true,
            },
            {
              id: "row-2",
              rowNumber: 3,
              bookingDate: "2026-01-02",
              amountNok: -50,
              currency: "NOK",
              normalizedMerchant: "ruter",
              paymentType: "CARD",
              categoryId: "cat-transport",
              potentialDuplicate: false,
            },
          ],
        },
      }),
    });
  });

  await page.route("**/api/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        categories: [
          {
            id: "cat-transport",
            name: "Transport",
            kind: "EXPENSE",
            accountId: null,
          },
          {
            id: "cat-food",
            name: "Food",
            kind: "EXPENSE",
            accountId: null,
          },
        ],
      }),
    });
  });

  await page.route("**/api/imports/submit", async (route, request) => {
    submitRequestBody = request.postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          imported: 2,
          potentialDuplicates: 1,
          invalid: 1,
          skipped: 0,
        },
      }),
    });
  });

  await page.goto("/import");

  await expect(page.getByRole("heading", { name: "Import" })).toBeVisible();
  await expect(page.getByLabel("Account")).toHaveValue("acc-1");

  await page.getByLabel("CSV file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;123,45", "utf8"),
  });

  await page.getByRole("button", { name: "Parse CSV" }).click();

  await expect(page.getByText("Parse summary")).toBeVisible();
  await expect(page.getByText("Imported")).toBeVisible();
  await expect(page.getByText("Ignored reserved")).toBeVisible();
  await expect(page.getByText("Validation errors")).toBeVisible();
  await expect(
    page.getByText(
      'Row 4: Row 4 has invalid amount "abc". Expected Norwegian decimal format like 123,45.',
    ),
  ).toBeVisible();
  await expect(page.getByText("Review rows")).toBeVisible();
  await expect(page.getByText("Potential duplicates:")).toBeVisible();
  await expect(
    page.getByText("Potential duplicate", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("p", { hasText: /^Uncategorized$/ })).toBeVisible();

  const rowTwoCategory = page.getByLabel("Category for row 2");
  await expect(rowTwoCategory).toHaveValue("");
  await rowTwoCategory.selectOption("cat-food");
  await expect(rowTwoCategory).toHaveValue("cat-food");

  await page.getByRole("button", { name: "Submit reviewed rows" }).click();

  await expect(
    page.getByText(
      "Import complete. Imported 2, skipped 0, potential duplicates 1, invalid 1.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Review rows")).toHaveCount(0);
  await expect(page.getByText("Parse summary")).toHaveCount(0);
  await expect(page.getByLabel("CSV file")).toHaveValue("");
  expect(submitRequestBody).toEqual({
    sessionId: "session-1",
    invalidCount: 1,
    rows: [
      { rowId: "row-1", categoryId: "cat-food" },
      { rowId: "row-2", categoryId: "cat-transport" },
    ],
  });
});

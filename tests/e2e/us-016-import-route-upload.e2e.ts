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
        detection: {
          state: "certain",
          providerId: "provider-1",
          providerName: "DNB",
          score: 1,
          matchedHeaders: ["bokforingsdato", "belop"],
          candidates: [
            {
              providerId: "provider-1",
              providerName: "DNB",
              requiredMatches: 2,
              requiredTotal: 2,
              patternMatches: 0,
              score: 1,
            },
          ],
        },
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
          messageCleanupUnavailableReason: null,
          rows: [
            {
              id: "row-1",
              rowNumber: 2,
              bookingDate: "2026-01-01",
              amountNok: -123.45,
              currency: "NOK",
              normalizedMerchant: "joker",
              paymentType: "CARD",
              name: "joker",
              title: "JOKER TRONDHEIM",
              cleanedMessage: "Joker Trondheim",
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
              name: "ruter",
              title: "RUTER BILLETT",
              cleanedMessage: null,
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
  await expect(page.getByRole("combobox", { name: "Account" })).toHaveText(
    "Main Account",
  );

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
    page.getByText(
      "Default message selection uses AI-cleaned text when available. Rows without a suggestion keep the original message.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "JOKER TRONDHEIM", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Joker Trondheim", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "No suggestion", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Potential duplicate", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("p", { hasText: /^Uncategorized$/ })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Message choice for row 2" }),
  ).toHaveText("AI-cleaned message");
  await expect(
    page.getByRole("combobox", { name: "Message choice for row 3" }),
  ).toHaveText("Original message");

  await page
    .getByRole("combobox", { name: "Message choice for row 2" })
    .click();
  await page
    .getByRole("option", { name: "Original message", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Message choice for row 2" }),
  ).toHaveText("Original message");

  const rowTwoCategory = page.getByRole("combobox", {
    name: "Category for row 2",
  });
  await expect(rowTwoCategory).toHaveText("Uncategorized");
  await rowTwoCategory.click();
  await page.getByRole("option", { name: "Food", exact: true }).click();
  await expect(rowTwoCategory).toHaveText("Food");

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
      {
        rowId: "row-1",
        categoryId: "cat-food",
        selectedMessage: "JOKER TRONDHEIM",
      },
      {
        rowId: "row-2",
        categoryId: "cat-transport",
        selectedMessage: "RUTER BILLETT",
      },
    ],
  });
});

test("requires provider override when detection is uncertain and continues after manual selection", async ({
  page,
}) => {
  let parseAttempt = 0;

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
        categories: [],
      }),
    });
  });

  await page.route("**/api/imports/parse", async (route, request) => {
    const postData = request.postData() ?? "";

    if (parseAttempt === 0) {
      expect(postData).not.toContain('name="providerId"');
      parseAttempt += 1;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "PROVIDER_SELECTION_REQUIRED",
          message:
            "Provider detection is uncertain. Select a provider and parse again.",
          detection: {
            state: "uncertain",
            providerId: "provider-1",
            providerName: "Bank A",
            score: 0.6,
            matchedHeaders: ["dato"],
            candidates: [
              {
                providerId: "provider-1",
                providerName: "Bank A",
                requiredMatches: 2,
                requiredTotal: 3,
                patternMatches: 0,
                score: 0.6,
              },
              {
                providerId: "provider-2",
                providerName: "Bank B",
                requiredMatches: 2,
                requiredTotal: 3,
                patternMatches: 0,
                score: 0.55,
              },
            ],
          },
        }),
      });
      return;
    }

    expect(postData).toContain('name="providerId"');
    expect(postData).toContain("provider-2");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        detection: {
          state: "certain",
          providerId: "provider-2",
          providerName: "Bank B",
          score: 0.9,
          matchedHeaders: ["dato", "belop"],
          candidates: [
            {
              providerId: "provider-2",
              providerName: "Bank B",
              requiredMatches: 3,
              requiredTotal: 3,
              patternMatches: 0,
              score: 0.9,
            },
          ],
        },
        summary: {
          imported: 1,
          duplicates: 0,
          ignoredReserved: 0,
          invalid: 0,
        },
        errors: [],
        review: {
          sessionId: "session-override",
          potentialDuplicates: 0,
          messageCleanupUnavailableReason: "disabled",
          rows: [
            {
              id: "row-1",
              rowNumber: 2,
              bookingDate: "2026-01-01",
              amountNok: -200,
              currency: "NOK",
              normalizedMerchant: "butikk",
              paymentType: "CARD",
              name: "butikk",
              title: "BUTIKK",
              cleanedMessage: null,
              categoryId: null,
              potentialDuplicate: false,
            },
          ],
        },
      }),
    });
  });

  await page.goto("/import");
  await page.getByLabel("CSV file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Dato;Beløp\n01.01.2026;200,00", "utf8"),
  });

  await page.getByRole("button", { name: "Parse CSV" }).click();
  await expect(
    page.getByText(
      "Provider detection is uncertain. Select a provider and parse again.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Parse summary")).toHaveCount(0);

  const providerSelect = page.getByRole("combobox", { name: "Provider" });
  await providerSelect.click();
  await page.getByRole("option", { name: "Bank B", exact: true }).click();

  await page.getByRole("button", { name: "Parse CSV" }).click();
  await expect(page.getByText("Parse summary")).toBeVisible();
  await expect(
    page.getByText("Provider detection: certain (Bank B)."),
  ).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("parses CSV uploads from /import and shows validation feedback", async ({
  page,
}) => {
  let submitRequestBody: unknown = null;
  let submitRequestCount = 0;

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
    submitRequestCount += 1;
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

  await expect(
    page.getByRole("heading", { name: "Import", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Main Account DNB" }).click();

  await page.getByLabel("CSV file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;123,45", "utf8"),
  });

  await page.getByRole("button", { name: /Parse/ }).click();

  await expect(page.getByText("Import Preview")).toBeVisible();
  await expect(page.getByText("Validation errors")).toBeVisible();
  await expect(
    page.getByText(
      'Row 4: Row 4 has invalid amount "abc". Expected Norwegian decimal format like 123,45.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import 2 / 2" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "1 potential duplicate detected. Default message selection uses AI-cleaned text when available.",
    ),
  ).toBeVisible();
  // Row 1 (rowNumber 2): defaults to AI-cleaned message
  await expect(
    page.getByText("Joker Trondheim", { exact: true }),
  ).toBeVisible();
  // Row 2 (rowNumber 3): shows original message (no AI-cleaned alternative)
  await expect(page.getByText("RUTER BILLETT", { exact: true })).toBeVisible();
  // Toggle button available for row 1 which has an AI-cleaned message
  const toggleRow1 = page.getByRole("button", {
    name: "Toggle message source for row 2",
  });
  await expect(toggleRow1).toBeVisible();
  // Row 2 has no AI-cleaned message, so no toggle button
  await expect(
    page.getByRole("button", { name: "Toggle message source for row 3" }),
  ).not.toBeVisible();
  // Potential duplicate indicator shown for row 1
  await expect(page.getByLabel("Potential duplicate")).toBeVisible();
  // Switch row 1 to use original message
  await toggleRow1.click();
  await expect(
    page.getByText("JOKER TRONDHEIM", { exact: true }),
  ).toBeVisible();

  const rowThreeCategory = page.getByRole("combobox", {
    name: "Category for row 3",
  });
  await expect(rowThreeCategory).toHaveValue("Transport");
  await rowThreeCategory.click();
  await rowThreeCategory.pressSequentially("foo");
  await expect(
    page.getByRole("option", { name: "Transport", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("option", { name: "Food", exact: true }),
  ).toBeVisible();
  await page.getByRole("option", { name: "Food", exact: true }).click();
  await expect(rowThreeCategory).toHaveValue("Food");

  const rowOneNote = page.getByRole("textbox", {
    name: "Note for row 2",
  });
  await rowOneNote.fill("x".repeat(501));
  await page.getByRole("button", { name: "Import 2 / 2" }).click();
  await expect(
    page.getByText("Fix note validation errors before confirming import."),
  ).toBeVisible();
  await expect(
    page.getByText("Note must be 500 characters or fewer."),
  ).toBeVisible();
  expect(submitRequestCount).toBe(0);
  await rowOneNote.fill("Split groceries with roommate");

  // Deselect row 2 (rowNumber 3) so only row 1's finalized decisions should
  // be submitted for the selected subset.
  await page.getByRole("checkbox", { name: "Select row 3" }).click();
  await expect(
    page.getByRole("button", { name: "Import 1 / 2" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Import 1 / 2" }).click();

  await expect(
    page.locator("[data-sonner-toast]", {
      hasText: "Import complete. Imported 2, invalid 1.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Import Preview")).toHaveCount(0);
  await expect(page.getByLabel("CSV file")).toHaveValue("");
  expect(submitRequestCount).toBe(1);
  expect(submitRequestBody).toEqual({
    sessionId: "session-1",
    rows: [
      {
        rowId: "row-1",
        categoryId: null,
        selectedMessage: "JOKER TRONDHEIM",
        note: "Split groceries with roommate",
      },
    ],
  });
  expect(submitRequestBody).not.toHaveProperty("invalidCount");
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
  await page.getByRole("button", { name: "Main Account DNB" }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Dato;Beløp\n01.01.2026;200,00", "utf8"),
  });

  await page.getByRole("button", { name: /Parse/ }).click();
  await expect(
    page.getByText(
      "Provider detection is uncertain. Select a provider and parse again.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("button", { name: "Bank B", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();

  await page.getByRole("button", { name: /Parse/ }).click();
  await expect(page.getByText("Import Preview")).toBeVisible();
  await expect(page.getByText("Detected provider:")).toBeVisible();
  await expect(page.getByText("Bank B")).toBeVisible();
});

test("keeps review state visible when a blocking submit failure occurs", async ({
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

  await page.route("**/api/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ categories: [] }),
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
          candidates: [],
        },
        summary: {
          imported: 2,
          duplicates: 0,
          ignoredReserved: 0,
          invalid: 0,
        },
        errors: [],
        review: {
          sessionId: "session-failing",
          potentialDuplicates: 0,
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
              cleanedMessage: null,
              categoryId: null,
              potentialDuplicate: false,
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
              categoryId: null,
              potentialDuplicate: false,
            },
          ],
        },
      }),
    });
  });

  let submitRequestCount = 0;
  await page.route("**/api/imports/submit", async (route) => {
    submitRequestCount += 1;
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: "IMPORT_REVIEW_SESSION_NOT_FOUND",
        message: "Import review session was not found or already submitted.",
      }),
    });
  });

  await page.goto("/import");
  await page.getByRole("button", { name: "Main Account DNB" }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;123,45", "utf8"),
  });
  await page.getByRole("button", { name: /Parse/ }).click();
  await expect(page.getByText("Import Preview")).toBeVisible();

  // Deselect row 2 (rowNumber 3) before the failing submit, to confirm the
  // selection is still intact afterward.
  await page.getByRole("checkbox", { name: "Select row 3" }).click();
  await expect(
    page.getByRole("button", { name: "Import 1 / 2" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Import 1 / 2" }).click();

  await expect(
    page.getByText("Import review session was not found or already submitted."),
  ).toBeVisible();
  expect(submitRequestCount).toBe(1);

  // Review state remains available: the table, its rows, and the selection
  // made before the failed submit are all still present.
  await expect(page.getByText("Import Preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import 1 / 2" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Select row 2" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Select row 3" }),
  ).not.toBeChecked();
});

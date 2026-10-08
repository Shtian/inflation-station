import { expect, test } from "@playwright/test";

test("parses CSV uploads from /import and shows validation feedback", async ({
  page,
}) => {
  let submitRequestBody: unknown = null;
  let submitRequestCount = 0;
  let cleanupRequestCount = 0;

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
              name: "joker",
              title: "JOKER TRONDHEIM",
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
              categoryId: "cat-transport",
              potentialDuplicate: false,
            },
          ],
        },
        cleanup: {
          status: "planned",
          sessionId: "session-1",
          chunks: [{ index: 0, rowIds: ["row-1", "row-2"] }],
        },
      }),
    });
  });

  await page.route("**/api/imports/cleanup", async (route) => {
    cleanupRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        index: 0,
        status: "ok",
        suggestions: [{ rowId: "row-1", cleanedMessage: "Joker Trondheim" }],
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

  await page.getByLabel("Statement file").setInputFiles({
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
  // Before the cleanup chunk resolves: original messages, no toggle yet.
  await expect(
    page.getByText("JOKER TRONDHEIM", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("RUTER BILLETT", { exact: true })).toBeVisible();
  const toggleRow1 = page.getByRole("button", {
    name: "Toggle message source for row 2",
  });
  await expect(toggleRow1).not.toBeVisible();
  // Both rows show a pulsing icon while their chunk is in flight.
  const pendingSkeletonRow1 = page.getByLabel("Cleaning message for row 2");
  const pendingSkeletonRow2 = page.getByLabel("Cleaning message for row 3");
  await expect(pendingSkeletonRow1).toBeVisible();
  await expect(pendingSkeletonRow2).toBeVisible();

  // Row 1 (rowNumber 2): once the cleanup chunk resolves, it defaults to
  // the AI-cleaned message and gains a toggle.
  await expect(
    page.getByText("Joker Trondheim", { exact: true }),
  ).toBeVisible();
  await expect(toggleRow1).toBeVisible();
  await expect(pendingSkeletonRow1).not.toBeVisible();
  await expect(pendingSkeletonRow2).not.toBeVisible();
  // Row 2 (rowNumber 3): the chunk carried no suggestion for it, so it
  // keeps showing the original message with no toggle.
  await expect(page.getByText("RUTER BILLETT", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Toggle message source for row 3" }),
  ).not.toBeVisible();
  // Exactly one cleanup chunk request fires for the whole session.
  expect(cleanupRequestCount).toBe(1);
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
  await expect(page.getByLabel("Statement file")).toHaveValue("");
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

test("maps a CSV's columns before review, previews the parse and sends the confirmed mapping", async ({
  page,
}) => {
  const parseBodies: string[] = [];
  const headers = [
    "Dato",
    "Forklaring",
    "Rentedato",
    "Ut fra konto",
    "Inn på konto",
  ];
  const sampleRows = [
    {
      sourceRowNumber: 2,
      cells: ["02.01.2026", "Kiwi Majorstuen", "02.01.2026", "249,90", ""],
    },
    {
      sourceRowNumber: 3,
      cells: ["03.01.2026", "Lønn", "03.01.2026", "", "35 000,00"],
    },
    {
      sourceRowNumber: 4,
      cells: ["Reservert", "Narvesen", "", "45,00", ""],
    },
    {
      sourceRowNumber: 5,
      cells: ["05.01.2026", "Vy", "05.01.2026", "tolv", ""],
    },
  ];
  const guessedMapping = {
    date: { index: 0, header: "Dato" },
    amount: {
      kind: "split",
      inflow: { index: 4, header: "Inn på konto" },
      outflow: { index: 3, header: "Ut fra konto" },
    },
    description: [{ index: 1, header: "Forklaring" }],
    paymentType: null,
  };
  const confirmedMapping = {
    date: { index: 0, header: "Dato" },
    amount: {
      kind: "split",
      inflow: { index: 4, header: "Inn på konto" },
      outflow: { index: 3, header: "Ut fra konto" },
    },
    description: [
      { index: 1, header: "Forklaring" },
      { index: 2, header: "Rentedato" },
    ],
  };

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

  await page.route("**/api/imports/parse", async (route, request) => {
    const postData = request.postData() ?? "";
    parseBodies.push(postData);

    if (!postData.includes('name="columnMapping"')) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mappingRequired: true,
          columnMapping: {
            headers,
            sampleRows,
            guess: {
              mapping: guessedMapping,
              sources: {
                date: "heuristic",
                amount: "heuristic",
                description: "jev",
                paymentType: "none",
              },
            },
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        columnMapping: {
          headers,
          sampleRows,
          guess: {
            mapping: { ...confirmedMapping, paymentType: null },
            sources: {
              date: "saved",
              amount: "saved",
              description: "saved",
              paymentType: "saved",
            },
          },
        },
        summary: { imported: 1, duplicates: 0, ignoredReserved: 1, invalid: 1 },
        errors: [],
        review: {
          sessionId: "session-mapped",
          potentialDuplicates: 0,
          rows: [
            {
              id: "row-1",
              rowNumber: 2,
              bookingDate: "2026-01-02",
              amountNok: -249.9,
              currency: "NOK",
              normalizedMerchant: "kiwi majorstuen 02 01 2026",
              paymentType: "OTHER",
              name: "",
              title: "Kiwi Majorstuen 02.01.2026",
              categoryId: null,
              potentialDuplicate: false,
            },
          ],
        },
        cleanup: {
          status: "unavailable",
          reason: "disabled",
          rowIds: ["row-1"],
        },
      }),
    });
  });

  await page.goto("/import");
  await page.getByRole("button", { name: "Main Account DNB" }).click();
  await page.getByLabel("Statement file").setInputFiles({
    name: "dnb.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      '"Dato";"Forklaring";"Rentedato";"Ut fra konto";"Inn på konto"',
      "utf8",
    ),
  });
  await page.getByRole("button", { name: /Parse/ }).click();

  await expect(
    page.getByRole("heading", { name: "Map Columns" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Date column" })).toHaveText(
    /^Dato/,
  );
  await expect(
    page.getByRole("button", { name: "Separate in and out columns" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("combobox", { name: "Money in column" }),
  ).toHaveText(/^Inn på konto/);
  await expect(
    page.getByRole("combobox", { name: "Money out column" }),
  ).toHaveText(/^Ut fra konto/);
  await expect(
    page.getByRole("combobox", { name: "Payment type column" }),
  ).toHaveText(/^None/);
  await expect(
    page.getByRole("checkbox", { name: "Forklaring" }),
  ).toBeChecked();
  await expect(page.getByText("Suggested by Jev")).toBeVisible();
  await expect(page.getByText("Not found")).toBeVisible();

  const preview = page.getByRole("table", { name: "Column mapping preview" });
  await expect(preview.getByRole("row")).toHaveCount(3);
  await expect(preview.getByRole("row").nth(1)).toContainText("2026-01-02");
  await expect(preview.getByRole("row").nth(1)).toContainText("249,90");
  await expect(preview.getByRole("row").nth(1)).toContainText(
    "Kiwi Majorstuen",
  );
  await expect(preview.getByRole("row").nth(2)).toContainText("35 000,00");
  await expect(page.getByText("1 reserved row will be skipped.")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Preview parse errors" }),
  ).toHaveText(
    'Row 5 has invalid amount "tolv". Expected a number using "," as the decimal separator.',
  );

  await page.getByRole("checkbox", { name: "Rentedato" }).click();
  await expect(preview.getByRole("row").nth(1)).toContainText(
    "Kiwi Majorstuen 02.01.2026",
  );
  await expect(page.getByText("Chosen by you")).toBeVisible();

  await page.getByRole("button", { name: "Confirm mapping" }).click();

  await expect(page.getByText("Import Preview")).toBeVisible();
  await expect(
    page.getByText(
      "Dato · Inn på konto / Ut fra konto · Forklaring + Rentedato",
    ),
  ).toBeVisible();
  expect(parseBodies).toHaveLength(2);
  const sentMapping = /name="columnMapping"\r\n\r\n(.*)\r\n/.exec(
    parseBodies[1],
  )?.[1];
  expect(JSON.parse(sentMapping ?? "null")).toEqual(confirmedMapping);

  await page.getByRole("button", { name: "Edit column mapping" }).click();
  await expect(
    page.getByRole("heading", { name: "Map Columns" }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Rentedato" })).toBeChecked();
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Import Preview")).toBeVisible();
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
              categoryId: null,
              potentialDuplicate: false,
            },
          ],
        },
        cleanup: {
          status: "unavailable",
          reason: "key_missing",
          rowIds: ["row-1", "row-2"],
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
  await page.getByLabel("Statement file").setInputFiles({
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

test("applies a fast later-dispatched cleanup chunk without waiting on a slower earlier chunk", async ({
  page,
}) => {
  const reviewRows = Array.from({ length: 30 }, (_, i) => {
    const n = i + 1;
    return {
      id: `row-${n}`,
      rowNumber: i + 2,
      bookingDate: "2026-01-01",
      amountNok: -100 - i,
      currency: "NOK",
      normalizedMerchant: `merchant-${n}`,
      paymentType: "CARD",
      name: `merchant-${n}`,
      title: `MERCHANT ${n} STORE`,
      categoryId: null,
      potentialDuplicate: false,
    };
  });
  const chunk0RowIds = reviewRows.slice(0, 25).map((row) => row.id);
  const chunk1RowIds = reviewRows.slice(25).map((row) => row.id);

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
        summary: {
          imported: 30,
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
          status: "planned",
          sessionId: "session-1",
          chunks: [
            { index: 0, rowIds: chunk0RowIds },
            { index: 1, rowIds: chunk1RowIds },
          ],
        },
      }),
    });
  });

  await page.route("**/api/imports/cleanup", async (route, request) => {
    const body = request.postDataJSON() as { chunkIndex: number };

    if (body.chunkIndex === 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          index: 1,
          status: "ok",
          suggestions: [
            { rowId: "row-26", cleanedMessage: "Merchant 26 Store" },
          ],
        }),
      });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        index: 0,
        status: "ok",
        suggestions: [{ rowId: "row-1", cleanedMessage: "Merchant 1 Store" }],
      }),
    });
  });

  await page.goto("/import");
  await page.getByRole("button", { name: "Main Account DNB" }).click();
  await page.getByLabel("Statement file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;123,45", "utf8"),
  });
  await page.getByRole("button", { name: /Parse/ }).click();
  await expect(page.getByText("Import Preview")).toBeVisible();

  const pendingRow27 = page.getByLabel("Cleaning message for row 27", {
    exact: true,
  });
  const pendingRow2 = page.getByLabel("Cleaning message for row 2", {
    exact: true,
  });

  // Row 27 belongs to chunk 1 (last dispatched, resolves fastest).
  await expect(pendingRow27).toBeVisible();

  // Chunk 1 resolves and applies before chunk 0, even though chunk 0
  // dispatched first: row 27 gets its suggestion while row 2 still waits.
  await expect(
    page.getByText("Merchant 26 Store", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Toggle message source for row 27",
      exact: true,
    }),
  ).toBeVisible();
  await expect(pendingRow2).toBeVisible();

  // Chunk 0 eventually resolves too, and no pending rows remain.
  await expect(
    page.getByText("Merchant 1 Store", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Toggle message source for row 2",
      exact: true,
    }),
  ).toBeVisible();
  await expect(pendingRow27).not.toBeVisible();
  await expect(pendingRow2).not.toBeVisible();
});

test("isolates one chunk's failure from the others and clears it on retry", async ({
  page,
}) => {
  const attemptCounts = new Map<number, number>();

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
        summary: { imported: 3, duplicates: 0, ignoredReserved: 0, invalid: 0 },
        errors: [],
        review: {
          sessionId: "session-1",
          potentialDuplicates: 0,
          rows: [
            {
              id: "row-1",
              rowNumber: 2,
              bookingDate: "2026-01-01",
              amountNok: -100,
              currency: "NOK",
              normalizedMerchant: "joker",
              paymentType: "CARD",
              name: "joker",
              title: "JOKER OSLO",
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
              categoryId: null,
              potentialDuplicate: false,
            },
            {
              id: "row-3",
              rowNumber: 4,
              bookingDate: "2026-01-03",
              amountNok: -75,
              currency: "NOK",
              normalizedMerchant: "kiwi",
              paymentType: "CARD",
              name: "kiwi",
              title: "KIWI TRONDHEIM",
              categoryId: null,
              potentialDuplicate: false,
            },
          ],
        },
        cleanup: {
          status: "planned",
          sessionId: "session-1",
          chunks: [
            { index: 0, rowIds: ["row-1"] },
            { index: 1, rowIds: ["row-2"] },
            { index: 2, rowIds: ["row-3"] },
          ],
        },
      }),
    });
  });

  await page.route("**/api/imports/cleanup", async (route, request) => {
    const { chunkIndex } = request.postDataJSON() as { chunkIndex: number };
    const attempt = (attemptCounts.get(chunkIndex) ?? 0) + 1;
    attemptCounts.set(chunkIndex, attempt);

    if (chunkIndex === 0) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          index: 0,
          status: "ok",
          suggestions: [{ rowId: "row-1", cleanedMessage: "Joker Oslo" }],
        }),
      });
      return;
    }

    if (chunkIndex === 1) {
      if (attempt === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            index: 1,
            status: "failed",
            reason: "timeout",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          index: 1,
          status: "ok",
          suggestions: [{ rowId: "row-2", cleanedMessage: "Ruter Billett" }],
        }),
      });
      return;
    }

    // chunkIndex === 2
    if (attempt === 1) {
      await route.abort();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        index: 2,
        status: "ok",
        suggestions: [{ rowId: "row-3", cleanedMessage: "Kiwi Trondheim" }],
      }),
    });
  });

  await page.goto("/import");
  await page.getByRole("button", { name: "Main Account DNB" }).click();
  await page.getByLabel("Statement file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;100,00", "utf8"),
  });
  await page.getByRole("button", { name: /Parse/ }).click();
  await expect(page.getByText("Import Preview")).toBeVisible();

  // Chunk 0 succeeds: row 1 gets its cleaned text and a toggle.
  await expect(page.getByText("Joker Oslo", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Toggle message source for row 2" }),
  ).toBeVisible();

  // Chunk 1 reports a 200 {status:"failed", reason:"timeout"}: row 2 keeps
  // its original message, with no toggle and no sparkle.
  await expect(page.getByText("RUTER BILLETT", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Toggle message source for row 3" }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Cleaning message for row 3")).not.toBeVisible();

  // Chunk 2's request is aborted at the network level: row 3 keeps its
  // original message too, with no toggle and no sparkle.
  await expect(page.getByText("KIWI TRONDHEIM", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Toggle message source for row 4" }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Cleaning message for row 4")).not.toBeVisible();

  // The status line reports both failures, and Retry is offered.
  await expect(page.getByText("2 could not be cleaned.")).toBeVisible();
  const retryButton = page.getByRole("button", { name: "Retry" });
  await expect(retryButton).toBeVisible();

  // Retrying re-posts exactly the two failed chunk indices, and clears them.
  await retryButton.click();

  await expect(page.getByText("Ruter Billett", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Toggle message source for row 3" }),
  ).toBeVisible();
  await expect(page.getByText("Kiwi Trondheim", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Toggle message source for row 4" }),
  ).toBeVisible();
  await expect(page.getByText("could not be cleaned.")).toHaveCount(0);
  await expect(retryButton).not.toBeVisible();

  // Chunk 0 (already succeeded) was never re-posted by the retry.
  expect(attemptCounts.get(0)).toBe(1);
  expect(attemptCounts.get(1)).toBe(2);
  expect(attemptCounts.get(2)).toBe(2);
});

test("aborts the in-flight cleanup chunk on submit and persists what the table showed at click time", async ({
  page,
}) => {
  let cleanupRequestCount = 0;
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
        summary: { imported: 1, duplicates: 0, ignoredReserved: 0, invalid: 0 },
        errors: [],
        review: {
          sessionId: "session-1",
          potentialDuplicates: 0,
          rows: [
            {
              id: "row-1",
              rowNumber: 2,
              bookingDate: "2026-01-01",
              amountNok: -100,
              currency: "NOK",
              normalizedMerchant: "joker",
              paymentType: "CARD",
              name: "joker",
              title: "JOKER OSLO",
              categoryId: null,
              potentialDuplicate: false,
            },
          ],
        },
        cleanup: {
          status: "planned",
          sessionId: "session-1",
          chunks: [{ index: 0, rowIds: ["row-1"] }],
        },
      }),
    });
  });

  await page.route("**/api/imports/cleanup", async (route) => {
    cleanupRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          index: 0,
          status: "ok",
          suggestions: [{ rowId: "row-1", cleanedMessage: "Joker Oslo" }],
        }),
      });
    } catch {
      // The client already aborted the request; nothing left to fulfill.
    }
  });

  await page.route("**/api/imports/submit", async (route, request) => {
    submitRequestBody = request.postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          imported: 1,
          potentialDuplicates: 0,
          invalid: 0,
          skipped: 0,
        },
      }),
    });
  });

  await page.goto("/import");
  await page.getByRole("button", { name: "Main Account DNB" }).click();
  await page.getByLabel("Statement file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;100,00", "utf8"),
  });
  await page.getByRole("button", { name: /Parse/ }).click();
  await expect(page.getByText("Import Preview")).toBeVisible();

  // The chunk is still pending: the row shows its original message, no toggle yet.
  await expect(page.getByText("JOKER OSLO", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Toggle message source for row 2" }),
  ).not.toBeVisible();

  const abortedCleanupRequest = page.waitForEvent("requestfailed", (request) =>
    request.url().includes("/api/imports/cleanup"),
  );

  const confirmButton = page.getByRole("button", { name: "Import 1 / 1" });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  const failedRequest = await abortedCleanupRequest;
  expect(failedRequest.failure()?.errorText ?? "").toMatch(/abort/i);

  await expect(
    page.locator("[data-sonner-toast]", {
      hasText: "Import complete. Imported 1, invalid 0.",
    }),
  ).toBeVisible();
  expect(submitRequestBody).toEqual({
    sessionId: "session-1",
    rows: [
      {
        rowId: "row-1",
        categoryId: null,
        selectedMessage: "JOKER OSLO",
        note: null,
      },
    ],
  });
  expect(cleanupRequestCount).toBe(1);
});

test("re-parsing mid-stream cancels the first run and drops a late response for the superseded session", async ({
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
      body: JSON.stringify({ categories: [] }),
    });
  });

  await page.route("**/api/imports/parse", async (route) => {
    parseAttempt += 1;
    const sessionId = `session-${parseAttempt}`;
    const title = parseAttempt === 1 ? "JOKER OSLO" : "RUTER OSLO";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: { imported: 1, duplicates: 0, ignoredReserved: 0, invalid: 0 },
        errors: [],
        review: {
          sessionId,
          potentialDuplicates: 0,
          rows: [
            {
              id: "row-1",
              rowNumber: 2,
              bookingDate: "2026-01-01",
              amountNok: -100,
              currency: "NOK",
              normalizedMerchant: "row-1",
              paymentType: "CARD",
              name: "row-1",
              title,
              categoryId: null,
              potentialDuplicate: false,
            },
          ],
        },
        cleanup: {
          status: "planned",
          sessionId,
          chunks: [{ index: 0, rowIds: ["row-1"] }],
        },
      }),
    });
  });

  await page.route("**/api/imports/cleanup", async (route, request) => {
    const { sessionId } = request.postDataJSON() as { sessionId: string };

    if (sessionId === "session-1") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            index: 0,
            status: "ok",
            suggestions: [
              { rowId: "row-1", cleanedMessage: "Stale Joker Oslo" },
            ],
          }),
        });
      } catch {
        // The client already aborted the first run's request by re-parsing.
      }
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        index: 0,
        status: "ok",
        suggestions: [{ rowId: "row-1", cleanedMessage: "Fresh Ruter Oslo" }],
      }),
    });
  });

  await page.goto("/import");
  await page.getByRole("button", { name: "Main Account DNB" }).click();
  await page.getByLabel("Statement file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;100,00", "utf8"),
  });
  await page.getByRole("button", { name: /Parse/ }).click();
  await expect(page.getByText("Import Preview")).toBeVisible();
  await expect(page.getByText("JOKER OSLO", { exact: true })).toBeVisible();

  // Re-parse before session 1's chunk resolves. "Start over" keeps the
  // already-selected file, so Parse fires session 2 immediately.
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: /Parse/ }).click();
  await expect(page.getByText("Import Preview")).toBeVisible();
  await expect(
    page.getByText("Fresh Ruter Oslo", { exact: true }),
  ).toBeVisible();

  // Session 1's chunk resolves well after this point. Its late response
  // must never reach the row now showing session 2's data.
  await page.waitForTimeout(2000);
  await expect(
    page.getByText("Fresh Ruter Oslo", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Stale Joker Oslo")).toHaveCount(0);
});

import { expect, type Page, type Route, test } from "@playwright/test";

type StubCategory = { id: string; name: string; kind: string };

const BASE_CATEGORIES: StubCategory[] = [
  { id: "cat-transport", name: "Transport", kind: "EXPENSE" },
  { id: "cat-food", name: "Food", kind: "EXPENSE" },
];

/**
 * Serves GET /api/categories from a server-side list and answers POST like
 * the real route: 201 for a new name, 409 when the name already exists there.
 * `serverOnly` names exist on the server but stay out of every GET until the
 * page first POSTs, the way a category created in another tab after the page
 * loaded would.
 */
async function stubCategories(
  page: Page,
  { serverOnly = [] }: { serverOnly?: StubCategory[] } = {},
) {
  const created: StubCategory[] = [];
  const createPayloads: Array<{ name: string; kind: string }> = [];
  let posted = false;

  await page.route("**/api/categories", async (route: Route, request) => {
    if (request.method() === "POST") {
      const payload = request.postDataJSON() as { name: string; kind: string };
      posted = true;
      createPayloads.push(payload);
      const existing = [...BASE_CATEGORIES, ...serverOnly, ...created].find(
        (category) => category.name === payload.name,
      );
      if (existing) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "CATEGORY_NAME_MUST_BE_UNIQUE" }),
        });
        return;
      }
      const category = {
        id: `cat-new-${created.length + 1}`,
        name: payload.name,
        kind: payload.kind,
      };
      created.push(category);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          category: { ...category, classifierHint: null },
        }),
      });
      return;
    }

    const visible = posted
      ? [...BASE_CATEGORIES, ...serverOnly, ...created]
      : [...BASE_CATEGORIES, ...created];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        categories: visible.map((category) => ({
          ...category,
          accountId: null,
        })),
      }),
    });
  });

  return { createPayloads };
}

function importRow(id: string, rowNumber: number, amountNok: number) {
  return {
    id,
    rowNumber,
    bookingDate: "2026-01-01",
    amountNok,
    currency: "NOK",
    normalizedMerchant: `merchant ${rowNumber}`,
    paymentType: "CARD",
    name: `merchant ${rowNumber}`,
    title: `MERCHANT ${rowNumber}`,
    categoryId: null,
    potentialDuplicate: false,
  };
}

test("creates a category from an import row's picker and shares it with the other rows", async ({
  page,
}) => {
  const rows = [
    importRow("row-1", 2, -250),
    importRow("row-2", 3, 1200),
    importRow("row-3", 4, -80),
    importRow("row-4", 5, -40),
  ];
  let submitBody: null | {
    rows: Array<{ rowId: string; categoryId: string | null }>;
  } = null;

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
  const { createPayloads } = await stubCategories(page, {
    serverOnly: [{ id: "cat-hytte", name: "Hytte", kind: "EXPENSE" }],
  });
  await page.route("**/api/imports/parse", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          imported: rows.length,
          duplicates: 0,
          ignoredReserved: 0,
          invalid: 0,
        },
        errors: [],
        review: { sessionId: "session-1", potentialDuplicates: 0, rows },
        cleanup: {
          status: "unavailable",
          reason: "disabled",
          rowIds: rows.map((row) => row.id),
        },
      }),
    });
  });
  await page.route("**/api/imports/submit", async (route, request) => {
    submitBody = request.postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ summary: { imported: 4, invalid: 0 } }),
    });
  });

  await page.goto("/import");
  await page.getByRole("button", { name: "Main Account DNB" }).click();
  await page.getByLabel("Kontoutskrift").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;100,00", "utf8"),
  });
  await page.getByRole("button", { name: /Les inn/ }).click();
  await expect(page.getByText("Forhåndsvisning av import")).toBeVisible();

  const expenseRow = page.getByRole("combobox", { name: "Kategori for rad 2" });
  await expenseRow.click();
  await expenseRow.pressSequentially("Kaffe");
  await expect(
    page.getByRole("option", { name: "Opprett «Kaffe»" }),
  ).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(
    page.locator("[data-sonner-toast]", {
      hasText: "Kategorien «Kaffe» er opprettet",
    }),
  ).toBeVisible();
  await expect(expenseRow).toHaveValue("Kaffe");
  expect(createPayloads).toEqual([{ name: "Kaffe", kind: "EXPENSE" }]);

  const incomeRow = page.getByRole("combobox", { name: "Kategori for rad 3" });
  await incomeRow.click();
  await incomeRow.pressSequentially("kaffe");
  await expect(
    page.getByRole("option", { name: "Kaffe", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("option", { name: /^Opprett/ })).toHaveCount(0);
  await incomeRow.fill("Lønn");
  await page.getByRole("option", { name: "Opprett «Lønn»" }).click();
  await expect(incomeRow).toHaveValue("Lønn");
  expect(createPayloads.at(-1)).toEqual({ name: "Lønn", kind: "INCOME" });

  const partialRow = page.getByRole("combobox", { name: "Kategori for rad 4" });
  await partialRow.click();
  await partialRow.pressSequentially("Foo");
  await expect(
    page.getByRole("option", { name: "Opprett «Foo»" }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(partialRow).toHaveValue("Food");
  expect(createPayloads).toHaveLength(2);

  const duplicateRow = page.getByRole("combobox", {
    name: "Kategori for rad 5",
  });
  await duplicateRow.click();
  await duplicateRow.pressSequentially("Hytte");
  await page.getByRole("option", { name: "Opprett «Hytte»" }).click();
  await expect(duplicateRow).toHaveValue("Hytte");
  expect(createPayloads.at(-1)).toEqual({ name: "Hytte", kind: "EXPENSE" });
  await expect(
    page.locator("[data-sonner-toast]", {
      hasText: "Kunne ikke opprette kategorien",
    }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Importer 4 / 4" }).click();
  await expect
    .poll(() =>
      submitBody?.rows.map(({ rowId, categoryId }) => ({ rowId, categoryId })),
    )
    .toEqual([
      { rowId: "row-1", categoryId: "cat-new-1" },
      { rowId: "row-2", categoryId: "cat-new-2" },
      { rowId: "row-3", categoryId: "cat-food" },
      { rowId: "row-4", categoryId: "cat-hytte" },
    ]);
});

test("creates a category from the edit transaction dialog and saves it on the transaction", async ({
  page,
}) => {
  let patchPayload: null | { categoryId: string | null } = null;

  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [{ id: "acc-1", name: "Main Account", institution: "DNB" }],
      }),
    });
  });
  const { createPayloads } = await stubCategories(page);
  await page.route("**/api/transactions/txn-1", async (route, request) => {
    if (request.method() !== "PATCH") {
      await route.fallback();
      return;
    }
    patchPayload = request.postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "txn-1" }),
    });
  });
  await page.route("**/api/transactions**", async (route, request) => {
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [
          {
            id: "txn-1",
            accountId: "acc-1",
            categoryId: null,
            categoryName: null,
            bookingDate: "2026-01-15",
            amountNok: -210,
            currency: "NOK",
            normalizedMerchant: "Corner Shop",
            paymentType: "CARD",
            note: null,
            createdAt: "2026-01-15T08:00:00.000Z",
            updatedAt: "2026-01-15T08:00:00.000Z",
          },
        ],
        pagination: { total: 1, page: 1, pageSize: 25, totalPages: 1 },
      }),
    });
  });

  await page.goto("/transactions");
  await page.getByRole("row", { name: /Corner Shop/ }).hover();
  await page
    .getByRole("button", { name: "Handlinger for transaksjon fra 2026-01-15" })
    .click();
  await page.getByRole("menuitem", { name: "Rediger" }).click();

  const categoryCombobox = page
    .getByRole("dialog", { name: "Rediger transaksjon" })
    .getByRole("combobox", { name: "Kategori" });
  await categoryCombobox.click();
  await categoryCombobox.pressSequentially("Gaver");
  await page.getByRole("option", { name: "Opprett «Gaver»" }).click();

  await expect(
    page.locator("[data-sonner-toast]", {
      hasText: "Kategorien «Gaver» er opprettet",
    }),
  ).toBeVisible();
  await expect(categoryCombobox).toHaveValue("Gaver");
  expect(createPayloads).toEqual([{ name: "Gaver", kind: "EXPENSE" }]);

  await page.getByRole("button", { name: "Lagre endringer" }).click();
  await expect.poll(() => patchPayload?.categoryId).toBe("cat-new-1");
});

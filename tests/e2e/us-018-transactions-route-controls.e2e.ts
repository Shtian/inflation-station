import { expect, type Page, test } from "@playwright/test";

/**
 * The date filters are calendar popovers, not text inputs: open the popover,
 * click a day, then dismiss it. Clicking an already-selected day clears the
 * filter, which is how the tests below reset a date range.
 */
async function toggleDateFilter(page: Page, field: string, day: RegExp) {
  await page.getByLabel(field).click();
  const calendar = page.locator('[data-slot="popover-content"][data-open]');
  await calendar.getByRole("button", { name: day }).click();
  await page.keyboard.press("Escape");
  await expect(calendar).toHaveCount(0);
}

test("manages transactions filters and pagination controls from /transactions", async ({
  page,
}) => {
  // The calendars open on the current month, so pin the clock inside the month
  // the fixtures use instead of clicking back through the month nav.
  await page.clock.setFixedTime(new Date("2026-02-15T12:00:00"));

  const transactionRequests: string[] = [];

  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [
          { id: "acc-1", name: "Main Account", institution: "DNB" },
          { id: "acc-2", name: "Savings Account", institution: "Nordea" },
          {
            id: "acc-3",
            name: "No Transactions Account",
            institution: "Sparebanken",
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
          {
            id: "cat-groceries",
            name: "Groceries",
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

  await page.route("**/api/transactions**", async (route, request) => {
    const url = new URL(request.url());
    transactionRequests.push(url.search);
    const accountId = url.searchParams.get("accountId");
    const categoryId = url.searchParams.get("categoryId");
    const globalQuery = url.searchParams.get("globalQuery");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const sorting = url.searchParams.get("sorting");
    const pageParam = url.searchParams.get("page");
    const pageSizeParam = url.searchParams.get("pageSize");

    if (
      sorting === "amountNok:asc" &&
      pageParam === "1" &&
      pageSizeParam === "25"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              id: "txn-sort-asc-1",
              accountId: "acc-1",
              categoryId: "cat-groceries",
              categoryName: "Groceries",
              bookingDate: "2026-01-09",
              amountNok: -50,
              currency: "NOK",
              normalizedMerchant: "Sorted Asc Grocery",
              paymentType: "CARD",
              note: null,
              createdAt: "2026-01-09T09:00:00.000Z",
              updatedAt: "2026-01-09T09:00:00.000Z",
            },
          ],
          pagination: {
            total: 35,
            page: 1,
            pageSize: 25,
            totalPages: 2,
          },
        }),
      });
      return;
    }

    if (
      sorting === "amountNok:desc" &&
      pageParam === "1" &&
      pageSizeParam === "25"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              id: "txn-sort-desc-1",
              accountId: "acc-1",
              categoryId: "cat-food",
              categoryName: "Food",
              bookingDate: "2026-01-03",
              amountNok: -980,
              currency: "NOK",
              normalizedMerchant: "Sorted Desc Appliance",
              paymentType: "CARD",
              note: null,
              createdAt: "2026-01-03T09:00:00.000Z",
              updatedAt: "2026-01-03T09:00:00.000Z",
            },
          ],
          pagination: {
            total: 35,
            page: 1,
            pageSize: 25,
            totalPages: 2,
          },
        }),
      });
      return;
    }

    if (accountId === "acc-2" && pageParam === "1" && pageSizeParam === "25") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              id: "txn-acc2-1",
              accountId: "acc-2",
              categoryId: null,
              categoryName: null,
              bookingDate: "2026-02-01",
              amountNok: 500,
              currency: "NOK",
              normalizedMerchant: "Savings Transfer",
              paymentType: "TRANSFER",
              note: "Monthly transfer",
              createdAt: "2026-02-01T12:00:00.000Z",
              updatedAt: "2026-02-01T12:00:00.000Z",
            },
          ],
          pagination: {
            total: 1,
            page: 1,
            pageSize: 25,
            totalPages: 1,
          },
        }),
      });
      return;
    }

    if (accountId === "acc-3" && pageParam === "1" && pageSizeParam === "25") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [],
          pagination: {
            total: 0,
            page: 1,
            pageSize: 25,
            totalPages: 1,
          },
        }),
      });
      return;
    }

    if (pageParam === "2" && pageSizeParam === "25") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              id: "txn-page-2",
              accountId: "acc-1",
              categoryId: "cat-food",
              categoryName: "Food",
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
          pagination: {
            total: 35,
            page: 2,
            pageSize: 25,
            totalPages: 2,
          },
        }),
      });
      return;
    }

    if (pageParam === "1" && pageSizeParam === "10") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              id: "txn-page-size-10",
              accountId: "acc-1",
              categoryId: null,
              categoryName: null,
              bookingDate: "2026-01-20",
              amountNok: -75,
              currency: "NOK",
              normalizedMerchant: "Metro Kiosk",
              paymentType: "CARD",
              note: "Train ticket",
              createdAt: "2026-01-20T10:00:00.000Z",
              updatedAt: "2026-01-20T10:00:00.000Z",
            },
          ],
          pagination: {
            total: 35,
            page: 1,
            pageSize: 10,
            totalPages: 4,
          },
        }),
      });
      return;
    }

    if (
      pageParam === "1" &&
      pageSizeParam === "25" &&
      categoryId === "cat-groceries" &&
      globalQuery === "market" &&
      dateFrom === "2026-02-01" &&
      dateTo === "2026-02-28"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              id: "txn-filtered-1",
              accountId: accountId ?? "acc-1",
              categoryId: "cat-groceries",
              categoryName: "Groceries",
              bookingDate: "2026-02-11",
              amountNok: -99,
              currency: "NOK",
              normalizedMerchant: "Filtered Market",
              paymentType: "CARD",
              note: "Matched by filters",
              createdAt: "2026-02-11T09:00:00.000Z",
              updatedAt: "2026-02-11T09:00:00.000Z",
            },
          ],
          pagination: {
            total: 1,
            page: 1,
            pageSize: 25,
            totalPages: 1,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [
          {
            id: "txn-default-1",
            accountId: "acc-1",
            categoryId: "cat-groceries",
            categoryName: "Groceries",
            bookingDate: "2026-02-05",
            amountNok: -320,
            currency: "NOK",
            normalizedMerchant: "Supermarket",
            paymentType: "CARD",
            note: "Weekly groceries",
            createdAt: "2026-02-05T09:00:00.000Z",
            updatedAt: "2026-02-05T09:00:00.000Z",
          },
        ],
        pagination: {
          total: 35,
          page: 1,
          pageSize: 25,
          totalPages: 2,
        },
      }),
    });
  });

  await page.goto("/transactions");

  await expect(
    page.getByRole("heading", { name: "Transaksjoner" }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Dato" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Brukersted" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Kategori" }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Beløp" })).toBeVisible();
  // Payment type and Account ship hidden; the Columns menu is the only way in.
  await expect(
    page.getByRole("columnheader", { name: "Betalingstype" }),
  ).toHaveCount(0);
  await expect(page.getByText("35 transaksjoner totalt.")).toBeVisible();
  await expect(page.getByText("Supermarket")).toBeVisible();
  await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Vis memo for transaksjon fra 2026-02-05"),
  ).toBeVisible();
  await page.getByLabel("Vis memo for transaksjon fra 2026-02-05").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Weekly groceries");

  const previousPage = page.getByRole("button", {
    name: "Gå til forrige side",
  });
  const nextPage = page.getByRole("button", { name: "Gå til neste side" });

  // Both controls stay mounted at the edges of the range, so the only signal
  // that the table knows where it is comes from the disabled state.
  await expect(previousPage).toBeDisabled();
  await expect(nextPage).toBeEnabled();

  await nextPage.click();
  await expect(page).toHaveURL(/[?&]page=2(&|$)/);
  await expect(page.getByText("Corner Shop")).toBeVisible();
  await expect(nextPage).toBeDisabled();
  await expect(previousPage).toBeEnabled();

  await previousPage.click();
  await expect(page).toHaveURL(/[?&]page=1(&|$)/);
  await expect(page.getByText("Supermarket")).toBeVisible();
  await expect(previousPage).toBeDisabled();

  await nextPage.click();
  await expect(page.getByText("Corner Shop")).toBeVisible();

  // Re-sorting reshuffles which rows land on which page, so the table has to
  // drop back to page 1 instead of stranding the reader mid-range.
  await page
    .getByRole("columnheader", { name: "Beløp" })
    .getByRole("button", { name: "Beløp" })
    .click();
  await expect(page).toHaveURL(/[?&]page=1(&|$)/);
  await expect(page).toHaveURL(/sorting=amountNok%3Aasc/);
  await expect(page.getByText("Sorted Asc Grocery")).toBeVisible();

  await page
    .getByRole("columnheader", { name: "Beløp" })
    .getByRole("button", { name: "Beløp" })
    .click();
  await expect(page).toHaveURL(/sorting=amountNok%3Adesc/);
  await expect(page.getByText("Sorted Desc Appliance")).toBeVisible();

  await page
    .getByRole("columnheader", { name: "Beløp" })
    .getByRole("button", { name: "Beløp" })
    .click();
  await expect(page).not.toHaveURL(/sorting=/);

  const paymentTypeHeader = page.getByRole("columnheader", {
    name: "Betalingstype",
  });

  await page.getByRole("button", { name: "Kolonner" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Betalingstype" }).click();
  await expect(paymentTypeHeader).toBeVisible();
  await expect(page.getByText("CARD")).toBeVisible();

  // Reload with the column switched ON, away from its default. A restore that
  // silently falls back to defaults now fails instead of passing by accident.
  await page.reload();
  await expect(paymentTypeHeader).toBeVisible();

  await page.getByRole("button", { name: "Kolonner" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Betalingstype" }).click();
  await expect(paymentTypeHeader).toHaveCount(0);

  // The menu deliberately stays open across toggles, so dismiss it before
  // touching the filter bar underneath.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitemcheckbox")).toHaveCount(0);

  await page.getByLabel("Konto").click();
  await page.getByRole("option", { name: "Savings Account" }).click();
  await expect(page).toHaveURL(/accountId=acc-2/);
  await expect(page.getByText("1 transaksjon totalt.")).toBeVisible();
  await expect(page.getByText("Savings Transfer")).toBeVisible();
  await expect(page.getByText("Ukategorisert")).toBeVisible();
  await expect(
    page.getByLabel("Vis memo for transaksjon fra 2026-02-01"),
  ).toBeVisible();
  await page.getByLabel("Vis memo for transaksjon fra 2026-02-01").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Monthly transfer");

  await page.getByLabel("Konto").click();
  await page.getByRole("option", { name: "Alle kontoer" }).click();

  await page.getByLabel("Søk").fill("market");
  await expect(page).toHaveURL(/globalQuery=market/);
  await toggleDateFilter(page, "Fra dato", /\b1\. februar 2026/);
  await expect(page).toHaveURL(/dateFrom=2026-02-01/);
  await toggleDateFilter(page, "Til dato", /\b28\. februar 2026/);
  await expect(page).toHaveURL(/dateTo=2026-02-28/);
  await page.getByLabel("Kategori").click();
  await page.getByRole("option", { name: "Groceries", exact: true }).click();
  await expect(page).toHaveURL(/globalQuery=market/);
  await expect(page).toHaveURL(/dateFrom=2026-02-01/);
  await expect(page).toHaveURL(/dateTo=2026-02-28/);
  await expect(page).toHaveURL(/categoryId=cat-groceries/);

  await expect
    .poll(() =>
      transactionRequests.some(
        (search) =>
          search.includes("globalQuery=market") &&
          search.includes("dateFrom=2026-02-01") &&
          search.includes("dateTo=2026-02-28") &&
          search.includes("categoryId=cat-groceries"),
      ),
    )
    .toBe(true);

  await expect(page.getByText("Filtered Market")).toBeVisible();

  await page.getByLabel("Søk").fill("");
  await toggleDateFilter(page, "Fra dato", /\b1\. februar 2026/);
  await expect(page).not.toHaveURL(/dateFrom=/);
  await toggleDateFilter(page, "Til dato", /\b28\. februar 2026/);
  await expect(page).not.toHaveURL(/dateTo=/);
  // The category filter is a searchable combobox with no "all" option -
  // emptying the query is what clears it.
  await page.getByLabel("Kategori").fill("");
  await expect(page).not.toHaveURL(/categoryId=/);
  await expect(page.getByText("Supermarket")).toBeVisible();

  await nextPage.click();
  await expect(page).toHaveURL(/[?&]page=2(&|$)/);
  await expect(page.getByText("Corner Shop")).toBeVisible();
  await expect(page.getByText("Food")).toBeVisible();
  await expect(
    page.getByLabel("Vis memo for transaksjon fra 2026-01-15"),
  ).toHaveCount(0);

  // Resizing the page invalidates the current offset, so this must also land
  // back on page 1 rather than keeping page=2 against a 4-page range.
  await page.locator("#transactions-rows-per-page").click();
  await page.getByRole("option", { name: "10", exact: true }).click();
  await expect(page).toHaveURL(/pageSize=10/);
  await expect(page).toHaveURL(/[?&]page=1(&|$)/);
  await expect(page.getByText("Metro Kiosk")).toBeVisible();
  await expect(page.getByText("Ukategorisert")).toBeVisible();
  await expect(
    page.getByLabel("Vis memo for transaksjon fra 2026-01-20"),
  ).toBeVisible();
  await page.getByLabel("Vis memo for transaksjon fra 2026-01-20").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Train ticket");

  await page.locator("#transactions-rows-per-page").click();
  await page.getByRole("option", { name: "25", exact: true }).click();
  await page.getByLabel("Konto").click();
  await page.getByRole("option", { name: "No Transactions Account" }).click();
  await expect(
    page.getByText("Fant ingen transaksjoner for de valgte filtrene."),
  ).toBeVisible();
  await expect(page.getByText("0 transaksjoner totalt.")).toBeVisible();
});

test("edits a transaction in a modal and keeps pagination state after save", async ({
  page,
}) => {
  let updatedMerchant = "Corner Shop";
  let updatedCategoryId: string | null = "cat-transport";
  let updatedCategoryName = "Transport";
  let updatedNote: string | null = "Legacy reminder";
  let lastPatchPayload: null | {
    categoryId: string | null;
    bookingDate: string;
    amountNok: number;
    merchant: string;
    paymentType: string;
    note: string | null;
  } = null;

  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [{ id: "acc-1", name: "Main Account", institution: "DNB" }],
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
            id: "cat-food",
            name: "Food",
            kind: "EXPENSE",
            accountId: null,
          },
          {
            id: "cat-transport",
            name: "Transport",
            kind: "EXPENSE",
            accountId: null,
          },
        ],
      }),
    });
  });

  await page.route("**/api/transactions/txn-page-2", async (route, request) => {
    if (request.method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const payload = (await request.postDataJSON()) as {
      categoryId: string | null;
      bookingDate: string;
      amountNok: number;
      merchant: string;
      paymentType: string;
      note: string | null;
    };

    lastPatchPayload = payload;
    updatedMerchant = payload.merchant;
    updatedCategoryId = payload.categoryId;
    updatedCategoryName =
      payload.categoryId === "cat-food" ? "Food" : "Uncategorized";
    updatedNote = payload.note;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "txn-page-2" }),
    });
  });

  await page.route("**/api/transactions**", async (route, request) => {
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }

    const url = new URL(request.url());
    const pageParam = url.searchParams.get("page");
    const pageSizeParam = url.searchParams.get("pageSize");

    if (pageParam === "2" && pageSizeParam === "25") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              id: "txn-page-2",
              accountId: "acc-1",
              categoryId: updatedCategoryId,
              categoryName: updatedCategoryId ? updatedCategoryName : null,
              bookingDate: "2026-01-15",
              amountNok: -210,
              currency: "NOK",
              normalizedMerchant: updatedMerchant,
              paymentType: "CARD",
              note: updatedNote,
              createdAt: "2026-01-15T08:00:00.000Z",
              updatedAt: "2026-01-15T08:00:00.000Z",
            },
          ],
          pagination: {
            total: 35,
            page: 2,
            pageSize: 25,
            totalPages: 2,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [
          {
            id: "txn-page-1",
            accountId: "acc-1",
            categoryId: null,
            categoryName: null,
            bookingDate: "2026-02-05",
            amountNok: -320,
            currency: "NOK",
            normalizedMerchant: "Supermarket",
            paymentType: "CARD",
            note: null,
            createdAt: "2026-02-05T09:00:00.000Z",
            updatedAt: "2026-02-05T09:00:00.000Z",
          },
        ],
        pagination: {
          total: 35,
          page: 1,
          pageSize: 25,
          totalPages: 2,
        },
      }),
    });
  });

  await page.goto("/transactions?page=2");

  await expect(page.getByText("Corner Shop")).toBeVisible();

  await page.getByRole("row", { name: /Corner Shop/ }).hover();
  await page
    .getByRole("button", { name: "Handlinger for transaksjon fra 2026-01-15" })
    .click();
  await page.getByRole("menuitem", { name: "Rediger" }).click();
  await expect(
    page.getByRole("heading", { name: "Rediger transaksjon" }),
  ).toBeVisible();
  await expect(page.getByLabel("Valuta")).toHaveCount(0);
  await expect(page.getByLabel("Notat")).toHaveValue("Legacy reminder");

  // Validation and the server both measure the trimmed note, so padding a
  // max-length note must not push the counter past the limit.
  await page.getByLabel("Notat").fill(`  ${"x".repeat(500)}  `);
  await expect(page.getByText("500/500 tegn")).toBeVisible();
  await expect(page.getByLabel("Notat")).toHaveAttribute(
    "aria-invalid",
    "false",
  );

  await page.getByLabel("Notat").fill("x".repeat(501));
  await page.getByRole("button", { name: "Lagre endringer" }).click();
  await expect(page.getByLabel("Notat")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByRole("alert")).toHaveText(
    "Notatet kan ikke være lengre enn 500 tegn.",
  );
  await expect.poll(() => lastPatchPayload).toBeNull();

  await page.getByLabel("Brukersted").fill("Updated Corner Shop");
  await page.getByLabel("Notat").fill("");
  const categoryCombobox = page
    .getByRole("dialog", { name: "Rediger transaksjon" })
    .getByRole("combobox", { name: "Kategori" });
  await expect(categoryCombobox).toHaveValue("Transport");
  await categoryCombobox.click();
  await categoryCombobox.pressSequentially("foo");
  await expect(
    page.getByRole("option", { name: "Transport", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("option", { name: "Food", exact: true }),
  ).toBeVisible();
  await page.getByRole("option", { name: "Food", exact: true }).click();
  await expect(categoryCombobox).toHaveValue("Food");
  await page.getByRole("button", { name: "Lagre endringer" }).click();

  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Updated Corner Shop")).toBeVisible();
  await expect(page.getByText("Food")).toBeVisible();
  await expect.poll(() => lastPatchPayload?.categoryId).toBe("cat-food");
  await expect
    .poll(() => Object.hasOwn(lastPatchPayload ?? {}, "currency"))
    .toBe(false);
  await expect
    .poll(() => lastPatchPayload?.merchant)
    .toBe("Updated Corner Shop");
  await expect.poll(() => lastPatchPayload?.note).toBeNull();
});

test("confirms transaction deletion and keeps pagination valid after last-row removal", async ({
  page,
}) => {
  let isDeleted = false;
  let deleteCallCount = 0;

  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [{ id: "acc-1", name: "Main Account", institution: "DNB" }],
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
            id: "cat-groceries",
            name: "Groceries",
            kind: "EXPENSE",
            accountId: null,
          },
        ],
      }),
    });
  });

  await page.route("**/api/transactions/txn-page-2", async (route, request) => {
    if (request.method() !== "DELETE") {
      await route.fallback();
      return;
    }

    deleteCallCount += 1;
    isDeleted = true;
    await route.fulfill({ status: 204 });
  });

  await page.route("**/api/transactions**", async (route, request) => {
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }

    const url = new URL(request.url());
    const pageParam = url.searchParams.get("page");
    const pageSizeParam = url.searchParams.get("pageSize");

    if (!isDeleted && pageParam === "2" && pageSizeParam === "25") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              id: "txn-page-2",
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
          pagination: {
            total: 26,
            page: 2,
            pageSize: 25,
            totalPages: 2,
          },
        }),
      });
      return;
    }

    if (isDeleted && pageParam === "2" && pageSizeParam === "25") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [],
          pagination: {
            total: 25,
            page: 2,
            pageSize: 25,
            totalPages: 1,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [
          {
            id: "txn-page-1",
            accountId: "acc-1",
            categoryId: null,
            categoryName: null,
            bookingDate: "2026-02-05",
            amountNok: -320,
            currency: "NOK",
            normalizedMerchant: "Supermarket",
            paymentType: "CARD",
            note: null,
            createdAt: "2026-02-05T09:00:00.000Z",
            updatedAt: "2026-02-05T09:00:00.000Z",
          },
        ],
        pagination: {
          total: isDeleted ? 25 : 26,
          page: 1,
          pageSize: 25,
          totalPages: isDeleted ? 1 : 2,
        },
      }),
    });
  });

  await page.goto("/transactions");

  await page.getByRole("button", { name: "Gå til neste side" }).click();
  await expect(page).toHaveURL(/[?&]page=2(&|$)/);
  await expect(page.getByText("Corner Shop")).toBeVisible();

  const cornerShopRow = page
    .getByRole("row")
    .filter({ hasText: "Corner Shop" });
  const cornerShopActions = page.getByRole("button", {
    name: "Handlinger for transaksjon fra 2026-01-15",
  });

  // Row actions only materialize under group-hover, so the pointer has to be
  // over the row before the trigger is clickable.
  await cornerShopRow.hover();
  await cornerShopActions.click();
  await page.getByRole("menuitem", { name: "Slett" }).click();
  await expect(
    page.getByRole("heading", { name: "Slett transaksjon" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Avbryt", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Slett transaksjon" }),
  ).not.toBeVisible();
  await expect(page.getByText("Corner Shop")).toBeVisible();
  await expect.poll(() => deleteCallCount).toBe(0);

  await cornerShopRow.hover();
  await cornerShopActions.click();
  await page.getByRole("menuitem", { name: "Slett" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Slett", exact: true })
    .click();

  // Deleting the only row on page 2 shrinks the range to a single page, so the
  // manager has to clamp the now-out-of-range page instead of showing an empty
  // page 2.
  await expect(page).toHaveURL(/[?&]page=1(&|$)/);
  await expect(page.getByText("Supermarket")).toBeVisible();
  await expect(page.getByText("Corner Shop")).not.toBeVisible();
  await expect.poll(() => deleteCallCount).toBe(1);
});

test("adds a transaction from the modal and counts note length the way validation does", async ({
  page,
}) => {
  let lastPostPayload: null | {
    accountId: string;
    bookingDate: string;
    amountNok: number;
    merchant: string;
    paymentType: string;
    categoryId?: string;
    note?: string;
  } = null;
  let addedRow: null | Record<string, unknown> = null;

  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [{ id: "acc-1", name: "Main Account", institution: "DNB" }],
      }),
    });
  });

  await page.route("**/api/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        categories: [
          { id: "cat-food", name: "Food", kind: "EXPENSE", accountId: null },
        ],
      }),
    });
  });

  await page.route("**/api/transactions**", async (route, request) => {
    if (request.method() === "POST") {
      lastPostPayload =
        (await request.postDataJSON()) as typeof lastPostPayload;
      addedRow = {
        id: "txn-new",
        accountId: "acc-1",
        categoryId: null,
        categoryName: null,
        bookingDate: lastPostPayload?.bookingDate,
        amountNok: lastPostPayload?.amountNok,
        currency: "NOK",
        merchant: lastPostPayload?.merchant,
        normalizedMerchant: lastPostPayload?.merchant,
        paymentType: lastPostPayload?.paymentType,
        note: lastPostPayload?.note ?? null,
        createdAt: "2026-02-10T09:00:00.000Z",
        updatedAt: "2026-02-10T09:00:00.000Z",
      };

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: addedRow.id }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: addedRow ? [addedRow] : [],
        pagination: {
          total: addedRow ? 1 : 0,
          page: 1,
          pageSize: 25,
          totalPages: 1,
        },
      }),
    });
  });

  await page.goto("/transactions");

  await page.getByRole("button", { name: "Legg til transaksjon" }).click();
  const dialog = page.getByRole("dialog", { name: "Legg til transaksjon" });
  await expect(dialog).toBeVisible();

  const note = dialog.getByLabel("Notat");
  const maxLengthNote = "x".repeat(500);

  await note.fill(maxLengthNote);
  await expect(dialog.getByText("500/500 tegn")).toBeVisible();

  // Validation and the server both measure the trimmed note, so padding a
  // max-length note must not push the counter past the limit.
  await note.fill(`  ${maxLengthNote}  `);
  await expect(dialog.getByText("500/500 tegn")).toBeVisible();
  await expect(note).toHaveAttribute("aria-invalid", "false");

  await note.fill(`  ${"x".repeat(501)}  `);
  await expect(dialog.getByText("501/500 tegn")).toHaveCount(0);
  await expect(
    dialog.getByText("Notatet kan ikke være lengre enn 500 tegn."),
  ).toBeVisible();
  await expect(note).toHaveAttribute("aria-invalid", "true");

  await note.fill("Weekly shop");
  await dialog.getByLabel("Konto").click();
  await page.getByRole("option", { name: "Main Account" }).click();
  await dialog.getByLabel("Dato").fill("2026-02-10");
  await dialog.getByLabel("Brukersted").fill("  Corner Shop  ");
  await dialog.getByLabel("Beløp (NOK)").fill("-12,50");
  await dialog.getByRole("button", { name: "Legg til transaksjon" }).click();

  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Transaksjon lagt til" }),
  ).toBeVisible();
  await expect.poll(() => lastPostPayload?.accountId).toBe("acc-1");
  await expect.poll(() => lastPostPayload?.merchant).toBe("Corner Shop");
  await expect.poll(() => lastPostPayload?.amountNok).toBe(-12.5);
  await expect.poll(() => lastPostPayload?.note).toBe("Weekly shop");
});

test("toggles the transactions table to full width and remembers it across reloads", async ({
  page,
}) => {
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [{ id: "acc-1", name: "Main Account", institution: "DNB" }],
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

  await page.route("**/api/transactions**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [],
        pagination: { total: 0, page: 1, pageSize: 25, totalPages: 1 },
      }),
    });
  });

  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/transactions");

  const main = page.locator("main");
  const fullWidthToggle = page.getByRole("button", { name: "Full bredde" });

  await expect(fullWidthToggle).toHaveAttribute("aria-pressed", "false");
  await expect(main).toHaveCSS("max-width", "1152px");

  await fullWidthToggle.click();
  await expect(fullWidthToggle).toHaveAttribute("aria-pressed", "true");
  await expect(main).toHaveCSS("max-width", "none");

  await page.reload();
  await expect(fullWidthToggle).toHaveAttribute("aria-pressed", "true");
  await expect(main).toHaveCSS("max-width", "none");

  await fullWidthToggle.click();
  await expect(fullWidthToggle).toHaveAttribute("aria-pressed", "false");
  await expect(main).toHaveCSS("max-width", "1152px");
});

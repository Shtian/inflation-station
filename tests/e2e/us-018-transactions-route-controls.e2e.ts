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
    page.getByRole("heading", { name: "Transactions" }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Date" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Merchant" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Category" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Amount" }),
  ).toBeVisible();
  // Payment type and Account ship hidden; the Columns menu is the only way in.
  await expect(
    page.getByRole("columnheader", { name: "Payment type" }),
  ).toHaveCount(0);
  await expect(page.getByText("35 total transactions.")).toBeVisible();
  await expect(page.getByText("Supermarket")).toBeVisible();
  await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("View memo for transaction from 2026-02-05"),
  ).toBeVisible();
  await page.getByLabel("View memo for transaction from 2026-02-05").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Weekly groceries");

  const previousPage = page.getByRole("button", {
    name: "Go to previous page",
  });
  const nextPage = page.getByRole("button", { name: "Go to next page" });

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
    .getByRole("columnheader", { name: "Amount" })
    .getByRole("button", { name: "Amount" })
    .click();
  await expect(page).toHaveURL(/[?&]page=1(&|$)/);
  await expect(page).toHaveURL(/sorting=amountNok%3Aasc/);
  await expect(page.getByText("Sorted Asc Grocery")).toBeVisible();

  await page
    .getByRole("columnheader", { name: "Amount" })
    .getByRole("button", { name: "Amount" })
    .click();
  await expect(page).toHaveURL(/sorting=amountNok%3Adesc/);
  await expect(page.getByText("Sorted Desc Appliance")).toBeVisible();

  await page
    .getByRole("columnheader", { name: "Amount" })
    .getByRole("button", { name: "Amount" })
    .click();
  await expect(page).not.toHaveURL(/sorting=/);

  const paymentTypeHeader = page.getByRole("columnheader", {
    name: "Payment type",
  });

  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Payment type" }).click();
  await expect(paymentTypeHeader).toBeVisible();
  await expect(page.getByText("CARD")).toBeVisible();

  // Reload with the column switched ON, away from its default. A restore that
  // silently falls back to defaults now fails instead of passing by accident.
  await page.reload();
  await expect(paymentTypeHeader).toBeVisible();

  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Payment type" }).click();
  await expect(paymentTypeHeader).toHaveCount(0);

  // The menu deliberately stays open across toggles, so dismiss it before
  // touching the filter bar underneath.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitemcheckbox")).toHaveCount(0);

  await page.getByLabel("Account").click();
  await page.getByRole("option", { name: "Savings Account" }).click();
  await expect(page).toHaveURL(/accountId=acc-2/);
  await expect(page.getByText("1 total transactions.")).toBeVisible();
  await expect(page.getByText("Savings Transfer")).toBeVisible();
  await expect(page.getByText("Uncategorized")).toBeVisible();
  await expect(
    page.getByLabel("View memo for transaction from 2026-02-01"),
  ).toBeVisible();
  await page.getByLabel("View memo for transaction from 2026-02-01").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Monthly transfer");

  await page.getByLabel("Account").click();
  await page.getByRole("option", { name: "All accounts" }).click();

  await page.getByLabel("Search").fill("market");
  await expect(page).toHaveURL(/globalQuery=market/);
  await toggleDateFilter(page, "Date from", /February 1st, 2026/);
  await expect(page).toHaveURL(/dateFrom=2026-02-01/);
  await toggleDateFilter(page, "Date to", /February 28th, 2026/);
  await expect(page).toHaveURL(/dateTo=2026-02-28/);
  await page.getByLabel("Category").click();
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

  await page.getByLabel("Search").fill("");
  await toggleDateFilter(page, "Date from", /February 1st, 2026/);
  await expect(page).not.toHaveURL(/dateFrom=/);
  await toggleDateFilter(page, "Date to", /February 28th, 2026/);
  await expect(page).not.toHaveURL(/dateTo=/);
  // The category filter is a searchable combobox with no "all" option -
  // emptying the query is what clears it.
  await page.getByLabel("Category").fill("");
  await expect(page).not.toHaveURL(/categoryId=/);
  await expect(page.getByText("Supermarket")).toBeVisible();

  await nextPage.click();
  await expect(page).toHaveURL(/[?&]page=2(&|$)/);
  await expect(page.getByText("Corner Shop")).toBeVisible();
  await expect(page.getByText("Food")).toBeVisible();
  await expect(
    page.getByLabel("View memo for transaction from 2026-01-15"),
  ).toHaveCount(0);

  // Resizing the page invalidates the current offset, so this must also land
  // back on page 1 rather than keeping page=2 against a 4-page range.
  await page.locator("#transactions-rows-per-page").click();
  await page.getByRole("option", { name: "10", exact: true }).click();
  await expect(page).toHaveURL(/pageSize=10/);
  await expect(page).toHaveURL(/[?&]page=1(&|$)/);
  await expect(page.getByText("Metro Kiosk")).toBeVisible();
  await expect(page.getByText("Uncategorized")).toBeVisible();
  await expect(
    page.getByLabel("View memo for transaction from 2026-01-20"),
  ).toBeVisible();
  await page.getByLabel("View memo for transaction from 2026-01-20").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Train ticket");

  await page.locator("#transactions-rows-per-page").click();
  await page.getByRole("option", { name: "25", exact: true }).click();
  await page.getByLabel("Account").click();
  await page.getByRole("option", { name: "No Transactions Account" }).click();
  await expect(
    page.getByText("No transactions found for the selected filters."),
  ).toBeVisible();
  await expect(page.getByText("0 total transactions.")).toBeVisible();
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
    .getByRole("button", { name: "Actions for transaction from 2026-01-15" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit transaction" }),
  ).toBeVisible();
  await expect(page.getByLabel("Currency")).toHaveCount(0);
  await expect(page.getByLabel("Note")).toHaveValue("Legacy reminder");

  // Validation and the server both measure the trimmed note, so padding a
  // max-length note must not push the counter past the limit.
  await page.getByLabel("Note").fill(`  ${"x".repeat(500)}  `);
  await expect(page.getByText("500/500 characters")).toBeVisible();
  await expect(page.getByLabel("Note")).toHaveAttribute(
    "aria-invalid",
    "false",
  );

  await page.getByLabel("Note").fill("x".repeat(501));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByLabel("Note")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toHaveText(
    "Note must be 500 characters or fewer.",
  );
  await expect.poll(() => lastPatchPayload).toBeNull();

  await page.getByLabel("Merchant").fill("Updated Corner Shop");
  await page.getByLabel("Note").fill("");
  const categoryCombobox = page
    .getByRole("dialog", { name: "Edit transaction" })
    .getByRole("combobox", { name: "Category" });
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
  await page.getByRole("button", { name: "Save changes" }).click();

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

  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page).toHaveURL(/[?&]page=2(&|$)/);
  await expect(page.getByText("Corner Shop")).toBeVisible();

  const cornerShopRow = page
    .getByRole("row")
    .filter({ hasText: "Corner Shop" });
  const cornerShopActions = page.getByRole("button", {
    name: "Actions for transaction from 2026-01-15",
  });

  // Row actions only materialize under group-hover, so the pointer has to be
  // over the row before the trigger is clickable.
  await cornerShopRow.hover();
  await cornerShopActions.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(
    page.getByRole("heading", { name: "Delete transaction" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Delete transaction" }),
  ).not.toBeVisible();
  await expect(page.getByText("Corner Shop")).toBeVisible();
  await expect.poll(() => deleteCallCount).toBe(0);

  await cornerShopRow.hover();
  await cornerShopActions.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
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

  await page.getByRole("button", { name: "Add transaction" }).click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await expect(dialog).toBeVisible();

  const note = dialog.getByLabel("Note");
  const maxLengthNote = "x".repeat(500);

  await note.fill(maxLengthNote);
  await expect(dialog.getByText("500/500 characters")).toBeVisible();

  // Validation and the server both measure the trimmed note, so padding a
  // max-length note must not push the counter past the limit.
  await note.fill(`  ${maxLengthNote}  `);
  await expect(dialog.getByText("500/500 characters")).toBeVisible();
  await expect(note).toHaveAttribute("aria-invalid", "false");

  await note.fill(`  ${"x".repeat(501)}  `);
  await expect(dialog.getByText("501/500 characters")).toHaveCount(0);
  await expect(
    dialog.getByText("Note must be 500 characters or fewer."),
  ).toBeVisible();
  await expect(note).toHaveAttribute("aria-invalid", "true");

  await note.fill("Weekly shop");
  await dialog.getByLabel("Account").click();
  await page.getByRole("option", { name: "Main Account" }).click();
  await dialog.getByLabel("Date").fill("2026-02-10");
  await dialog.getByLabel("Merchant").fill("  Corner Shop  ");
  await dialog.getByLabel("Amount (NOK)").fill("-12,50");
  await dialog.getByRole("button", { name: "Add transaction" }).click();

  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Transaction added" }),
  ).toBeVisible();
  await expect.poll(() => lastPostPayload?.accountId).toBe("acc-1");
  await expect.poll(() => lastPostPayload?.merchant).toBe("Corner Shop");
  await expect.poll(() => lastPostPayload?.amountNok).toBe(-12.5);
  await expect.poll(() => lastPostPayload?.note).toBe("Weekly shop");
});

import { expect, test } from "@playwright/test";

test("manages transactions filters and pagination controls from /transactions", async ({
  page,
}) => {
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
    const accountId = url.searchParams.get("accountId");
    const pageParam = url.searchParams.get("page");
    const pageSizeParam = url.searchParams.get("pageSize");

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
    page.getByRole("columnheader", { name: "Payment type" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Category" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Amount" }),
  ).toBeVisible();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(page.getByText("35 total transactions.")).toBeVisible();
  await expect(page.getByText("Supermarket")).toBeVisible();
  await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("View memo for transaction from 2026-02-05"),
  ).toBeVisible();
  await page.getByLabel("View memo for transaction from 2026-02-05").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Weekly groceries");

  await page.getByLabel("Account").click();
  await page.getByRole("option", { name: "Savings Account" }).click();
  await expect(page.getByText("Page 1 of 1")).toBeVisible();
  await expect(page.getByText("Savings Transfer")).toBeVisible();
  await expect(page.getByText("Uncategorized")).toBeVisible();
  await expect(
    page.getByLabel("View memo for transaction from 2026-02-01"),
  ).toBeVisible();
  await page.getByLabel("View memo for transaction from 2026-02-01").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Monthly transfer");

  await page.getByLabel("Account").click();
  await page.getByRole("option", { name: "All accounts" }).click();

  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByText("Corner Shop")).toBeVisible();
  await expect(page.getByText("Food")).toBeVisible();
  await expect(
    page.getByLabel("View memo for transaction from 2026-01-15"),
  ).toHaveCount(0);

  await page.locator("#transactions-rows-per-page").click();
  await page.getByRole("option", { name: "10", exact: true }).click();
  await expect(page.getByText("Page 1 of 4")).toBeVisible();
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
  let updatedCategoryId: string | null = null;
  let updatedCategoryName = "Uncategorized";
  let updatedNote: string | null = "Legacy reminder";
  let lastPatchPayload: null | {
    categoryId: string | null;
    bookingDate: string;
    amountNok: number;
    normalizedMerchant: string;
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
      normalizedMerchant: string;
      paymentType: string;
      note: string | null;
    };

    lastPatchPayload = payload;
    updatedMerchant = payload.normalizedMerchant;
    updatedCategoryId = payload.categoryId;
    updatedCategoryName =
      payload.categoryId === "cat-food" ? "Food" : "Uncategorized";
    updatedNote = payload.note;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        transaction: {
          id: "txn-page-2",
          accountId: "acc-1",
          categoryId: payload.categoryId,
          bookingDate: payload.bookingDate,
          amountNok: payload.amountNok,
          currency: "NOK",
          normalizedMerchant: payload.normalizedMerchant,
          paymentType: payload.paymentType,
          note: payload.note,
          createdAt: "2026-01-15T08:00:00.000Z",
          updatedAt: "2026-02-16T12:00:00.000Z",
        },
      }),
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

  await page.goto("/transactions");

  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByText("Corner Shop")).toBeVisible();

  await page
    .getByRole("button", { name: "Actions for transaction from 2026-01-15" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit transaction" }),
  ).toBeVisible();
  await expect(page.getByLabel("Currency")).toHaveCount(0);
  await expect(page.getByLabel("Note")).toHaveValue("Legacy reminder");
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
  await categoryCombobox.click();
  await page.getByRole("option", { name: "Food", exact: true }).click();
  await expect(categoryCombobox).toHaveValue("Food");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByText("Updated Corner Shop")).toBeVisible();
  await expect(page.getByText("Food")).toBeVisible();
  await expect.poll(() => lastPatchPayload?.categoryId).toBe("cat-food");
  await expect
    .poll(() => Object.hasOwn(lastPatchPayload ?? {}, "currency"))
    .toBe(false);
  await expect
    .poll(() => lastPatchPayload?.normalizedMerchant)
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
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByText("Corner Shop")).toBeVisible();

  await page
    .getByRole("button", { name: "Actions for transaction from 2026-01-15" })
    .click();
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

  await page
    .getByRole("button", { name: "Actions for transaction from 2026-01-15" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();

  await expect(page.getByText("Page 1 of 1")).toBeVisible();
  await expect(page.getByText("Supermarket")).toBeVisible();
  await expect(page.getByText("Corner Shop")).not.toBeVisible();
  await expect.poll(() => deleteCallCount).toBe(1);
});

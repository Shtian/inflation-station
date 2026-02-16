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
              bookingDate: "2026-02-01",
              amountNok: 500,
              currency: "NOK",
              normalizedMerchant: "Savings Transfer",
              paymentType: "TRANSFER",
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
              categoryId: null,
              bookingDate: "2026-01-15",
              amountNok: -210,
              currency: "NOK",
              normalizedMerchant: "Corner Shop",
              paymentType: "CARD",
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
              bookingDate: "2026-01-20",
              amountNok: -75,
              currency: "NOK",
              normalizedMerchant: "Metro Kiosk",
              paymentType: "CARD",
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
            categoryId: null,
            bookingDate: "2026-02-05",
            amountNok: -320,
            currency: "NOK",
            normalizedMerchant: "Supermarket",
            paymentType: "CARD",
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
    page.getByRole("columnheader", { name: "Amount" }),
  ).toBeVisible();
  await expect(page.getByText("Page 1 of 2.")).toBeVisible();
  await expect(page.getByText("35 total transactions.")).toBeVisible();
  await expect(page.getByText("Supermarket")).toBeVisible();

  await page.getByLabel("Account").click();
  await page.getByRole("option", { name: "Savings Account" }).click();
  await expect(page.getByText("Page 1 of 1.")).toBeVisible();
  await expect(page.getByText("Savings Transfer")).toBeVisible();

  await page.getByLabel("Account").click();
  await page.getByRole("option", { name: "All accounts" }).click();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2.")).toBeVisible();
  await expect(page.getByText("Corner Shop")).toBeVisible();

  await page.getByLabel("Page size").click();
  await page.getByRole("option", { name: "10 rows" }).click();
  await expect(page.getByText("Page 1 of 4.")).toBeVisible();
  await expect(page.getByText("Metro Kiosk")).toBeVisible();

  await page.getByLabel("Page size").click();
  await page.getByRole("option", { name: "25 rows" }).click();
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
  let lastPatchPayload: null | {
    bookingDate: string;
    amountNok: number;
    currency: string;
    normalizedMerchant: string;
    paymentType: string;
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

  await page.route("**/api/transactions/txn-page-2", async (route, request) => {
    if (request.method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const payload = (await request.postDataJSON()) as {
      bookingDate: string;
      amountNok: number;
      currency: string;
      normalizedMerchant: string;
      paymentType: string;
    };

    lastPatchPayload = payload;
    updatedMerchant = payload.normalizedMerchant;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        transaction: {
          id: "txn-page-2",
          accountId: "acc-1",
          categoryId: null,
          bookingDate: payload.bookingDate,
          amountNok: payload.amountNok,
          currency: payload.currency,
          normalizedMerchant: payload.normalizedMerchant,
          paymentType: payload.paymentType,
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
              categoryId: null,
              bookingDate: "2026-01-15",
              amountNok: -210,
              currency: "NOK",
              normalizedMerchant: updatedMerchant,
              paymentType: "CARD",
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
            bookingDate: "2026-02-05",
            amountNok: -320,
            currency: "NOK",
            normalizedMerchant: "Supermarket",
            paymentType: "CARD",
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

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2.")).toBeVisible();
  await expect(page.getByText("Corner Shop")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit transaction" }),
  ).toBeVisible();

  await page.getByLabel("Merchant").fill("Updated Corner Shop");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Page 2 of 2.")).toBeVisible();
  await expect(page.getByText("Updated Corner Shop")).toBeVisible();
  await expect
    .poll(() => lastPatchPayload?.normalizedMerchant)
    .toBe("Updated Corner Shop");
});

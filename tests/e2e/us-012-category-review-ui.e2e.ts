import { expect, test } from "@playwright/test";

type ReviewItem = {
  transaction: {
    id: string;
    bookingDate: string;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: string;
  };
  suggestion: {
    id: string;
    source: "RULE" | "OPENAI";
    confidence: number | null;
    reasoning: string | null;
    category: {
      id: string;
      name: string;
    };
  };
};

test("reviews suggestions, supports bulk accept and inline edit, then submits", async ({
  page,
}) => {
  const categories = [
    { id: "cat-food", name: "Food", kind: "EXPENSE", accountId: null },
    { id: "cat-rent", name: "Rent", kind: "EXPENSE", accountId: null },
    {
      id: "cat-transport",
      name: "Transport",
      kind: "EXPENSE",
      accountId: null,
    },
  ];

  let pending: ReviewItem[] = [
    {
      transaction: {
        id: "tx-1",
        bookingDate: "2026-01-04",
        amountNok: -139.5,
        normalizedMerchant: "joker",
        paymentType: "CARD",
      },
      suggestion: {
        id: "sug-1",
        source: "RULE",
        confidence: 0.9,
        reasoning: "Matched merchant keyword",
        category: {
          id: "cat-food",
          name: "Food",
        },
      },
    },
    {
      transaction: {
        id: "tx-2",
        bookingDate: "2026-01-06",
        amountNok: -12000,
        normalizedMerchant: "utleier",
        paymentType: "TRANSFER",
      },
      suggestion: {
        id: "sug-2",
        source: "OPENAI",
        confidence: 0.64,
        reasoning: "Likely recurring housing cost",
        category: {
          id: "cat-food",
          name: "Food",
        },
      },
    },
  ];

  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    });
  });

  await page.route("**/api/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ categories }),
    });
  });

  await page.route("**/api/categorization/review", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: pending, count: pending.length }),
      });
      return;
    }

    const payload = request.postDataJSON() as {
      decisions: Array<{ transactionId: string; categoryId: string }>;
    };

    const ids = new Set(
      payload.decisions.map((decision) => decision.transactionId),
    );
    pending = pending.filter((item) => !ids.has(item.transaction.id));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ updated: payload.decisions.length, skipped: 0 }),
    });
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Category Review" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "joker" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "utleier" })).toBeVisible();

  const jokerSelect = page.getByLabel("Final category for joker");
  const utleierSelect = page.getByLabel("Final category for utleier");

  await jokerSelect.selectOption("cat-transport");
  await expect(jokerSelect).toHaveValue("cat-transport");

  await page.getByRole("button", { name: "Use suggested for all" }).click();
  await expect(jokerSelect).toHaveValue("cat-food");

  await utleierSelect.selectOption("cat-rent");
  await expect(utleierSelect).toHaveValue("cat-rent");

  await page.getByRole("button", { name: "Submit review decisions" }).click();

  await expect(page.getByText("Submitted review decisions.")).toBeVisible();
  await expect(page.getByText("No pending suggestions.")).toBeVisible();
});

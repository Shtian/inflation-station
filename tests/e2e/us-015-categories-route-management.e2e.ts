import { expect, test } from "@playwright/test";

type Category = {
  id: string;
  name: string;
  kind: "EXPENSE" | "INCOME" | "TRANSFER";
  accountId: string | null;
};

type CategoryRule = {
  id: string;
  accountId: string | null;
  categoryId: string;
  merchantContains: string;
  paymentType: "CARD" | "TRANSFER" | "EFT" | "CASH" | "OTHER" | null;
  priority: number;
  category: {
    id: string;
    name: string;
  };
};

test("manages categories and category rules from /categories", async ({
  page,
}) => {
  const accounts = [
    {
      id: "acc-main",
      name: "Main Account",
      institution: "DNB",
      isActive: true,
    },
  ];

  let categories: Category[] = [
    { id: "cat-food", name: "Food", kind: "EXPENSE", accountId: null },
  ];
  let rules: CategoryRule[] = [];

  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accounts }),
    });
  });

  await page.route("**/api/categories", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ categories }),
      });
      return;
    }

    const payload = request.postDataJSON() as {
      name: string;
      kind: Category["kind"];
      accountId: string | null;
    };

    const nextCategory: Category = {
      id: `cat-${categories.length + 1}`,
      name: payload.name,
      kind: payload.kind,
      accountId: payload.accountId,
    };
    categories = [...categories, nextCategory];

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ category: nextCategory }),
    });
  });

  await page.route("**/api/categories/*", async (route, request) => {
    if (request.method() !== "DELETE") {
      await route.fallback();
      return;
    }

    const categoryId = request.url().split("/").at(-1) ?? "";
    categories = categories.filter((category) => category.id !== categoryId);
    rules = rules.filter((rule) => rule.categoryId !== categoryId);

    await route.fulfill({
      status: 204,
      contentType: "application/json",
      body: "null",
    });
  });

  await page.route("**/api/category-rules", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rules }),
      });
      return;
    }

    const payload = request.postDataJSON() as {
      accountId: string | null;
      categoryId: string;
      merchantContains: string;
      paymentType: CategoryRule["paymentType"];
      priority: number;
    };
    const category = categories.find((item) => item.id === payload.categoryId);

    const nextRule: CategoryRule = {
      id: `rule-${rules.length + 1}`,
      accountId: payload.accountId,
      categoryId: payload.categoryId,
      merchantContains: payload.merchantContains,
      paymentType: payload.paymentType,
      priority: payload.priority,
      category: {
        id: payload.categoryId,
        name: category?.name ?? "Unknown",
      },
    };
    rules = [...rules, nextRule];

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ rule: nextRule }),
    });
  });

  await page.route("**/api/category-rules/*", async (route, request) => {
    if (request.method() !== "DELETE") {
      await route.fallback();
      return;
    }

    const ruleId = request.url().split("/").at(-1) ?? "";
    rules = rules.filter((rule) => rule.id !== ruleId);

    await route.fulfill({
      status: 204,
      contentType: "application/json",
      body: "null",
    });
  });

  await page.goto("/categories");

  await expect(
    page.getByRole("heading", { name: "Category Management" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Category Rules" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Food" })).toBeVisible();

  await page.getByLabel("Category name").fill("Transport");
  await page.getByRole("button", { name: "Add category" }).click();

  await expect(page.getByText("Category added.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Transport" })).toBeVisible();

  await page.locator("#rule-category").selectOption({ label: "Transport" });
  await page.getByLabel("Merchant contains").fill("ruter");
  await page.getByLabel("Payment type (optional)").selectOption("CARD");
  await page.getByLabel("Priority").fill("5");
  await page.getByRole("button", { name: "Add rule" }).click();

  await expect(page.getByText("Category rule added.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "ruter" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "CARD" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("row", { name: /ruter/i })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Category rule removed.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "ruter" })).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("row", { name: /Transport/i })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Category removed.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Transport" })).toHaveCount(0);
});

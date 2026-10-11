import { expect, type Page, test } from "@playwright/test";

type Category = {
  id: string;
  name: string;
  kind: "EXPENSE" | "INCOME" | "TRANSFER";
  accountId: string | null;
  classifierHint: string | null;
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

type HintGuessBody =
  | {
      guess: {
        description: string | null;
        merchants: { key: string; label: string }[];
      };
    }
  | { guess: null; reason: string };

const DISABLED_HINT_GUESS: HintGuessBody = { guess: null, reason: "disabled" };

async function stubHintGuess(
  page: Page,
  respond: () => HintGuessBody | Promise<HintGuessBody> = () =>
    DISABLED_HINT_GUESS,
) {
  await page.route("**/api/categories/*/hint-guess", async (route) => {
    await route.fulfill({ json: await respond() });
  });
}

function recordHintGuessRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/hint-guess")) {
      urls.push(request.url());
    }
  });
  return urls;
}

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
    {
      id: "cat-food",
      name: "Food",
      kind: "EXPENSE",
      accountId: null,
      classifierHint: null,
    },
  ];
  let rules: CategoryRule[] = [];

  await stubHintGuess(page);
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
      classifierHint: string | null;
    };

    const nextCategory: Category = {
      id: `cat-${categories.length + 1}`,
      name: payload.name,
      kind: payload.kind,
      accountId: payload.accountId,
      classifierHint: payload.classifierHint,
    };
    categories = [...categories, nextCategory];

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ category: nextCategory }),
    });
  });

  await page.route("**/api/categories/*", async (route, request) => {
    const categoryId = request.url().split("/").at(-1) ?? "";

    if (request.method() === "PATCH") {
      const payload = request.postDataJSON() as {
        name: string;
        classifierHint: string | null;
      };
      categories = categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              name: payload.name,
              classifierHint: payload.classifierHint,
            }
          : category,
      );
      rules = rules.map((rule) => {
        if (rule.categoryId !== categoryId) {
          return rule;
        }

        return {
          ...rule,
          category: {
            ...rule.category,
            name: payload.name,
          },
        };
      });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          category:
            categories.find((category) => category.id === categoryId) ?? null,
        }),
      });
      return;
    }

    if (request.method() !== "DELETE") {
      await route.fallback();
      return;
    }

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
    page.getByText(
      "Transfer-category transactions are excluded from spend and income analytics.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Category Management" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Food No hint", exact: true }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Category rules" }).click();
  await expect(
    page.getByRole("heading", { name: "Category Rules" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Category management" }).click();

  await page.getByLabel("Category name").fill("Transport");
  await page.getByRole("button", { name: "Add category" }).click();

  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category added." }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Transport No hint", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("row", { name: /Transport/i })
    .getByRole("button", { name: "Actions for category Transport" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("dialog").getByLabel("Category name").fill("Commute");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category renamed." }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Commute No hint", exact: true }),
  ).toBeVisible();

  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 15_000,
  });

  await page
    .getByRole("row", { name: /Commute/i })
    .getByRole("button", { name: "Actions for category Commute" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Classifier hint (recommended)")
    .fill("Recurring transport top-ups");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category renamed." }),
  ).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 15_000,
  });

  await page
    .getByRole("row", { name: /Commute/i })
    .getByRole("button", { name: "Actions for category Commute" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Classifier hint (recommended)"),
  ).toHaveValue("Recurring transport top-ups");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel" })
    .click();

  await page.getByRole("tab", { name: "Category rules" }).click();

  await page.locator("#rule-category").click();
  await page.getByRole("option", { name: "Commute", exact: true }).click();
  await page.getByLabel("Merchant contains").fill("ruter");
  await page.getByLabel("Payment type (optional)").click();
  await page.getByRole("option", { name: "CARD", exact: true }).click();
  await page.getByLabel("Priority").fill("5");
  await page.getByRole("button", { name: "Add rule" }).click();

  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category rule added." }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "ruter", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "CARD", exact: true }),
  ).toBeVisible();
  await expect.poll(() => rules.at(-1)?.categoryId).toBe("cat-2");

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("row", { name: /ruter/i })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category rule removed." }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "ruter", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("tab", { name: "Category management" }).click();

  // Toasts stack in the bottom-right corner and sit over the row actions menu
  // that opens next, so let the previous one retire before reaching under it.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 15_000,
  });

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("row", { name: /Commute/i })
    .getByRole("button", { name: "Actions for category Commute" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category removed." }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Commute", exact: true }),
  ).toHaveCount(0);
});

test("flags categories without a classifier hint on /categories", async ({
  page,
}) => {
  let categories: Category[] = [
    {
      id: "cat-groceries",
      name: "Groceries",
      kind: "EXPENSE",
      accountId: null,
      classifierHint: "Rema 1000, Kiwi",
    },
    {
      id: "cat-food",
      name: "Food",
      kind: "EXPENSE",
      accountId: null,
      classifierHint: null,
    },
  ];

  await stubHintGuess(page);
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    });
  });

  await page.route("**/api/category-rules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rules: [] }),
    });
  });

  await page.route("**/api/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ categories }),
    });
  });

  await page.route("**/api/categories/*", async (route, request) => {
    if (request.method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const categoryId = request.url().split("/").at(-1) ?? "";
    const payload = request.postDataJSON() as {
      name: string;
      classifierHint: string | null;
    };
    categories = categories.map((category) =>
      category.id === categoryId
        ? {
            ...category,
            name: payload.name,
            classifierHint: payload.classifierHint,
          }
        : category,
    );

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        category:
          categories.find((category) => category.id === categoryId) ?? null,
      }),
    });
  });

  const notice = page
    .getByRole("status")
    .filter({ hasText: "Hints improve automatic categorization." });
  const foodRow = page.getByRole("row", { name: /Food/ });
  const groceriesRow = page.getByRole("row", { name: /Groceries/ });

  await page.goto("/categories");

  await expect(notice).toHaveText(
    "1 category has no hint. Hints improve automatic categorization.",
  );
  await expect(foodRow.getByText("No hint", { exact: true })).toBeVisible();
  await expect(groceriesRow).toBeVisible();
  await expect(groceriesRow.getByText("No hint", { exact: true })).toHaveCount(
    0,
  );

  await foodRow
    .getByRole("button", { name: "Actions for category Food" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Classifier hint (recommended)")
    .fill("Restaurants and takeaway: Foodora, Wolt");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category renamed." }),
  ).toBeVisible();
  await expect(notice).toHaveCount(0);
  await expect(foodRow.getByText("No hint", { exact: true })).toHaveCount(0);

  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 15_000,
  });

  await foodRow
    .getByRole("button", { name: "Actions for category Food" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Classifier hint (recommended)")
    .fill("");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category renamed." }),
  ).toBeVisible();
  await expect(notice).toHaveText(
    "1 category has no hint. Hints improve automatic categorization.",
  );
  await expect(foodRow.getByText("No hint", { exact: true })).toBeVisible();
});

type MerchantHistory = {
  transactionCount: number;
  merchants: { key: string; label: string; transactionCount: number }[];
};

async function stubHintEditorRoutes(
  page: Page,
  initialCategories: Category[],
  merchants: (categoryId: string) => MerchantHistory | null,
  hintGuess?: () => HintGuessBody | Promise<HintGuessBody>,
) {
  let categories = initialCategories;
  const patches: { name: string; classifierHint: string | null }[] = [];

  await stubHintGuess(page, hintGuess);
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({ json: { accounts: [] } });
  });
  await page.route("**/api/category-rules", async (route) => {
    await route.fulfill({ json: { rules: [] } });
  });
  await page.route("**/api/categories", async (route) => {
    await route.fulfill({ json: { categories } });
  });
  await page.route("**/api/categories/*", async (route, request) => {
    if (request.method() !== "PATCH") {
      await route.fallback();
      return;
    }
    const categoryId = request.url().split("/").at(-1) ?? "";
    const payload = request.postDataJSON() as {
      name: string;
      classifierHint: string | null;
    };
    patches.push(payload);
    categories = categories.map((category) =>
      category.id === categoryId ? { ...category, ...payload } : category,
    );
    await route.fulfill({
      json: { category: categories.find((c) => c.id === categoryId) },
    });
  });
  await page.route("**/api/categories/*/merchants", async (route, request) => {
    const categoryId = request.url().split("/").at(-2) ?? "";
    const history = merchants(categoryId);
    await route.fulfill(
      history
        ? { json: { history } }
        : { status: 500, json: { error: "INTERNAL" } },
    );
  });

  return patches;
}

async function openEditDialog(page: Page, categoryName: string) {
  await page
    .getByRole("row", { name: new RegExp(categoryName) })
    .getByRole("button", { name: `Actions for category ${categoryName}` })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  return page.getByRole("dialog");
}

test("prefills an empty classifier hint from the category's merchant history", async ({
  page,
}) => {
  const patches = await stubHintEditorRoutes(
    page,
    [
      {
        id: "cat-groceries",
        name: "Groceries",
        kind: "EXPENSE",
        accountId: null,
        classifierHint: null,
      },
    ],
    () => ({
      transactionCount: 73,
      merchants: [
        { key: "rema", label: "Rema", transactionCount: 41 },
        { key: "kiwi", label: "Kiwi", transactionCount: 23 },
        { key: "meny", label: "Meny", transactionCount: 9 },
      ],
    }),
  );

  const guessRequests = recordHintGuessRequests(page);
  await page.goto("/categories");
  const dialog = await openEditDialog(page, "Groceries");
  const hint = dialog.getByLabel("Classifier hint (recommended)");

  await expect(hint).toHaveValue("Rema, Kiwi, Meny");
  await expect(
    dialog.getByRole("button", { name: "Suggest with AI" }),
  ).toBeVisible();
  expect(guessRequests).toEqual([]);
  await expect(dialog.getByText("Suggested · not saved")).toBeVisible();
  await expect(dialog.getByText("Start with")).toHaveCount(0);
  await expect(dialog.getByText("Not in your history")).toHaveCount(0);
  await expect(
    dialog.getByText("Jev reads Groceries: Rema, Kiwi, Meny"),
  ).toBeVisible();

  const kiwi = dialog.getByRole("button", { name: "Kiwi 23" });
  await expect(kiwi).toHaveAttribute("aria-pressed", "true");
  await kiwi.click();

  await expect(hint).toHaveValue("Rema, Meny");
  await expect(kiwi).toHaveAttribute("aria-pressed", "false");
  await expect(dialog.getByText("Suggested · not saved")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category renamed." }),
  ).toBeVisible();
  expect(patches).toEqual([
    { name: "Groceries", classifierHint: "Rema, Meny" },
  ]);
});

test("asks before replacing a saved hint that names none of the category's merchants", async ({
  page,
}) => {
  const patches = await stubHintEditorRoutes(
    page,
    [
      {
        id: "cat-subscriptions",
        name: "Abonnementer",
        kind: "EXPENSE",
        accountId: null,
        classifierHint: "Rema 1000, Meny, Kiwi",
      },
    ],
    () => ({
      transactionCount: 28,
      merchants: [
        { key: "netflix", label: "Netflix", transactionCount: 12 },
        { key: "spotify", label: "Spotify", transactionCount: 12 },
        { key: "viaplay", label: "Viaplay", transactionCount: 4 },
      ],
    }),
  );
  const mismatch =
    "Your saved hint names Rema 1000, Meny, Kiwi. None of them appear in the 28 transactions filed here.";

  await page.goto("/categories");
  let dialog = await openEditDialog(page, "Abonnementer");
  let hint = dialog.getByLabel("Classifier hint (recommended)");

  await expect(dialog.getByText(mismatch)).toBeVisible();
  await dialog.getByRole("button", { name: "Keep mine" }).click();

  await expect(dialog.getByText(mismatch)).toHaveCount(0);
  await expect(hint).toHaveValue("Rema 1000, Meny, Kiwi");
  await expect(
    dialog.getByRole("button", { name: "Suggestions from 28 transactions" }),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category renamed." }),
  ).toBeVisible();
  expect(patches).toEqual([
    { name: "Abonnementer", classifierHint: "Rema 1000, Meny, Kiwi" },
  ]);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 15_000,
  });

  dialog = await openEditDialog(page, "Abonnementer");
  hint = dialog.getByLabel("Classifier hint (recommended)");
  await dialog.getByRole("button", { name: "Replace with suggestion" }).click();

  await expect(hint).toHaveValue("Netflix, Spotify, Viaplay");
  await expect(dialog.getByText(mismatch)).toHaveCount(0);
});

test("keeps today's plain hint field when merchant history fails to load", async ({
  page,
}) => {
  const patches = await stubHintEditorRoutes(
    page,
    [
      {
        id: "cat-food",
        name: "Food",
        kind: "EXPENSE",
        accountId: null,
        classifierHint: null,
      },
    ],
    () => null,
  );

  await page.goto("/categories");
  const merchantsResponse = page.waitForResponse(
    "**/api/categories/*/merchants",
  );
  const dialog = await openEditDialog(page, "Food");
  expect((await merchantsResponse).status()).toBe(500);
  const hint = dialog.getByLabel("Classifier hint (recommended)");

  await expect(hint).toHaveValue("");
  await expect(dialog.getByText("Suggested · not saved")).toHaveCount(0);
  await expect(dialog.getByText("From your history")).toHaveCount(0);

  await hint.fill("Restaurants and takeaway: Foodora, Wolt");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category renamed." }),
  ).toBeVisible();
  expect(patches).toEqual([
    {
      name: "Food",
      classifierHint: "Restaurants and takeaway: Foodora, Wolt",
    },
  ]);
});

const groceriesCategory: Category = {
  id: "cat-groceries",
  name: "Groceries",
  kind: "EXPENSE",
  accountId: null,
  classifierHint: null,
};

const groceriesHistory: MerchantHistory = {
  transactionCount: 64,
  merchants: [
    { key: "rema", label: "Rema", transactionCount: 41 },
    { key: "kiwi", label: "Kiwi", transactionCount: 23 },
  ],
};

const groceriesGuess: HintGuessBody = {
  guess: {
    description: "Groceries and food shopping",
    merchants: [{ key: "bunnpris", label: "Bunnpris" }],
  },
};

test("leads the hint with a guessed description and offers merchants not in history", async ({
  page,
}) => {
  const patches = await stubHintEditorRoutes(
    page,
    [groceriesCategory],
    () => groceriesHistory,
    () => groceriesGuess,
  );

  const guessRequests = recordHintGuessRequests(page);
  await page.goto("/categories");
  const dialog = await openEditDialog(page, "Groceries");
  const hint = dialog.getByLabel("Classifier hint (recommended)");
  const description = dialog.getByRole("checkbox", {
    name: "Start with “Groceries and food shopping”",
  });

  await expect(hint).toHaveValue("Rema, Kiwi");
  await expect(description).toHaveCount(0);
  expect(guessRequests).toEqual([]);

  await dialog.getByRole("button", { name: "Suggest with AI" }).click();

  await expect(hint).toHaveValue("Groceries and food shopping. Rema, Kiwi");
  expect(guessRequests).toEqual([
    expect.stringContaining("/api/categories/cat-groceries/hint-guess"),
  ]);
  await expect(
    dialog.getByRole("button", { name: "Suggest with AI" }),
  ).toHaveCount(0);
  await expect(dialog.getByText("Suggested · not saved")).toBeVisible();
  await expect(description).toBeChecked();

  await description.click();
  await expect(hint).toHaveValue("Rema, Kiwi");
  await expect(description).not.toBeChecked();

  const bunnpris = dialog.getByRole("button", { name: "Bunnpris" });
  await expect(bunnpris).toHaveAttribute("aria-pressed", "false");
  await bunnpris.click();
  await expect(hint).toHaveValue("Rema, Kiwi, Bunnpris");
  await expect(bunnpris).toHaveAttribute("aria-pressed", "true");

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Category renamed." }),
  ).toBeVisible();
  expect(patches).toEqual([
    { name: "Groceries", classifierHint: "Rema, Kiwi, Bunnpris" },
  ]);
});

test("keeps text typed while the guess is still loading", async ({ page }) => {
  await stubHintEditorRoutes(
    page,
    [groceriesCategory],
    () => groceriesHistory,
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return groceriesGuess;
    },
  );

  await page.goto("/categories");
  const dialog = await openEditDialog(page, "Groceries");
  const hint = dialog.getByLabel("Classifier hint (recommended)");

  await expect(hint).toHaveValue("Rema, Kiwi");
  await expect(dialog.getByText("Finding similar merchants…")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Suggest with AI" }).click();
  await expect(dialog.getByText("Finding similar merchants…")).toBeVisible();
  await hint.fill("Coop, Joker");

  await expect(dialog.getByText("Not in your history")).toBeVisible();
  await expect(dialog.getByText("Finding similar merchants…")).toHaveCount(0);
  await expect(hint).toHaveValue("Coop, Joker");
  await expect(
    dialog.getByRole("checkbox", {
      name: "Start with “Groceries and food shopping”",
    }),
  ).not.toBeChecked();
});

test("says so when AI suggestions are turned off", async ({ page }) => {
  await stubHintEditorRoutes(page, [groceriesCategory], () => groceriesHistory);

  const guessRequests = recordHintGuessRequests(page);
  await page.goto("/categories");
  const dialog = await openEditDialog(page, "Groceries");
  const hint = dialog.getByLabel("Classifier hint (recommended)");

  await expect(hint).toHaveValue("Rema, Kiwi");
  await dialog.getByRole("button", { name: "Suggest with AI" }).click();

  await expect(
    dialog.getByText("AI suggestions are turned off."),
  ).toBeVisible();
  expect(guessRequests).toHaveLength(1);
  await expect(
    dialog.getByRole("button", { name: "Suggest with AI" }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Try again" })).toHaveCount(
    0,
  );
  await expect(dialog.getByText("Start with")).toHaveCount(0);
  await expect(dialog.getByText("Not in your history")).toHaveCount(0);
  await expect(hint).toHaveValue("Rema, Kiwi");
});

test("offers a retry when the AI suggestion fails", async ({ page }) => {
  const responses: HintGuessBody[] = [
    { guess: null, reason: "provider_error" },
    groceriesGuess,
  ];
  await stubHintEditorRoutes(
    page,
    [groceriesCategory],
    () => groceriesHistory,
    () => responses.shift() ?? DISABLED_HINT_GUESS,
  );

  const guessRequests = recordHintGuessRequests(page);
  await page.goto("/categories");
  const dialog = await openEditDialog(page, "Groceries");
  const hint = dialog.getByLabel("Classifier hint (recommended)");

  await expect(hint).toHaveValue("Rema, Kiwi");
  await dialog.getByRole("button", { name: "Suggest with AI" }).click();

  await expect(dialog.getByText("Couldn't get AI suggestions.")).toBeVisible();
  await expect(hint).toHaveValue("Rema, Kiwi");
  await dialog.getByRole("button", { name: "Try again" }).click();

  await expect(hint).toHaveValue("Groceries and food shopping. Rema, Kiwi");
  await expect(dialog.getByText("Couldn't get AI suggestions.")).toHaveCount(0);
  expect(guessRequests).toHaveLength(2);
});

import { expect, test } from "@playwright/test";

type MockAccount = {
  id: string;
  name: string;
  institution: string | null;
  isActive: boolean;
};

test("manages accounts from /accounts with success and error feedback", async ({
  page,
}) => {
  const accounts: MockAccount[] = [
    {
      id: "acc-1",
      name: "Main Account",
      institution: "DNB",
      isActive: true,
    },
  ];

  await page.route("**/api/accounts", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accounts }),
      });
      return;
    }

    if (request.method() === "POST") {
      const body = request.postDataJSON() as {
        name: string;
        institution?: string;
      };
      const normalizedName = body.name.trim().toLowerCase();
      const duplicate = accounts.some(
        (account) => account.name.trim().toLowerCase() === normalizedName,
      );

      if (duplicate) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "ACCOUNT_NAME_MUST_BE_UNIQUE" }),
        });
        return;
      }

      const created: MockAccount = {
        id: `acc-${accounts.length + 1}`,
        name: body.name,
        institution: body.institution ?? null,
        isActive: true,
      };
      accounts.push(created);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ account: created }),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/accounts/*", async (route, request) => {
    const accountId = request.url().split("/").at(-1) ?? "";
    const index = accounts.findIndex((account) => account.id === accountId);

    if (index === -1) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "ACCOUNT_NOT_FOUND" }),
      });
      return;
    }

    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as {
        name?: string;
        institution?: string | null;
      };
      accounts[index] = {
        ...accounts[index],
        name: body.name ?? accounts[index].name,
        institution:
          body.institution === undefined
            ? accounts[index].institution
            : body.institution,
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ account: accounts[index] }),
      });
      return;
    }

    if (request.method() === "DELETE") {
      accounts.splice(index, 1);
      await route.fulfill({
        status: 204,
        contentType: "application/json",
        body: "",
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/accounts");

  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Main Account" })).toBeVisible();

  await page.getByLabel("Account name").fill("Savings Account");
  await page.getByLabel("Institution (optional)").fill("Nordea");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Account added.")).toBeVisible();

  await expect(
    page.getByRole("cell", { name: "Savings Account" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Rename" }).nth(1).click();
  await page.getByLabel("Edit name Savings Account").fill("Rainy Day Account");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Account updated.")).toBeVisible();

  await expect(
    page.getByRole("cell", { name: "Rainy Day Account" }),
  ).toBeVisible();

  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.getByRole("button", { name: "Remove" }).nth(1).click();
  await expect(page.getByText("Account removed.")).toBeVisible();

  await expect(
    page.getByRole("cell", { name: "Rainy Day Account" }),
  ).not.toBeVisible();

  await page.getByLabel("Account name").fill("Main Account");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(
    page.getByText("An account with this name already exists."),
  ).toBeVisible();
});

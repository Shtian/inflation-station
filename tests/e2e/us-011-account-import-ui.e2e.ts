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

  await expect(page.getByRole("heading", { name: "Kontoer" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Main Account", exact: true }),
  ).toBeVisible();

  await page.getByLabel("Kontonavn").fill("Savings Account");
  await page.getByLabel("Institusjon (valgfritt)").fill("Nordea");
  await page.getByRole("button", { name: "Legg til konto" }).click();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Konto lagt til." }),
  ).toBeVisible();

  await expect(
    page.getByRole("cell", { name: "Savings Account", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Handlinger for kontoen Savings Account" })
    .click();
  await page.getByRole("menuitem", { name: "Gi nytt navn" }).click();
  await page
    .getByLabel("Rediger navn Savings Account")
    .fill("Rainy Day Account");
  await page.getByRole("button", { name: "Lagre" }).click();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Konto oppdatert." }),
  ).toBeVisible();

  await expect(
    page.getByRole("cell", { name: "Rainy Day Account", exact: true }),
  ).toBeVisible();

  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await page
    .getByRole("button", { name: "Handlinger for kontoen Rainy Day Account" })
    .click();
  await page.getByRole("menuitem", { name: "Slett" }).click();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Konto fjernet." }),
  ).toBeVisible();

  await expect(
    page.getByRole("cell", { name: "Rainy Day Account", exact: true }),
  ).not.toBeVisible();

  await page.getByLabel("Kontonavn").fill("Main Account");
  await page.getByRole("button", { name: "Legg til konto" }).click();
  await expect(
    page.getByText("Det finnes allerede en konto med dette navnet."),
  ).toBeVisible();
});

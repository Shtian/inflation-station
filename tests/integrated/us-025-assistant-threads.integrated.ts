import { expect, test } from "@playwright/test";
import { INTEGRATED_DB_LOCK, layFixture } from "../support/integrated-database";

const QUESTION = "Hvor mye brukte jeg på dagligvarer i september?";
const ANSWER = "Du brukte 4 250 kr på Dagligvarer i september.";

const THREAD = {
  id: "thread-groceries",
  title: "Dagligvarer i september",
  messages: [
    { id: "u1", role: "user", parts: [{ type: "text", text: QUESTION }] },
    {
      id: "a1",
      role: "assistant",
      parts: [{ type: "text", text: ANSWER, state: "done" }],
    },
  ],
};

const OTHER_THREAD = {
  id: "thread-restaurants",
  title: "Restaurantbesøk",
  messages: [
    {
      id: "u2",
      role: "user",
      parts: [{ type: "text", text: "Hvor ofte spiste jeg ute?" }],
    },
  ],
};

test(
  "shows a saved conversation at its URL, also after a reload",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [],
      transactions: [],
      assistantThreads: [THREAD],
    });

    await page.goto(`/assistant?thread=${THREAD.id}`);

    const threads = page.getByRole("navigation", { name: "Samtaler" });
    await expect(
      threads.getByRole("link", { name: /Dagligvarer i september/ }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(QUESTION)).toBeVisible();
    await expect(page.getByText(ANSWER)).toBeVisible();

    await page.reload();

    await expect(page.getByText(QUESTION)).toBeVisible();
    await expect(page.getByText(ANSWER)).toBeVisible();
  },
);

test(
  "renames a conversation from its menu and keeps the name after a reload",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [],
      transactions: [],
      assistantThreads: [THREAD],
    });

    await page.goto("/assistant");
    await page
      .getByRole("button", { name: "Valg for Dagligvarer i september" })
      .click();
    await page.getByRole("menuitem", { name: "Gi nytt navn" }).click();
    const name = page.getByRole("textbox", { name: "Navn" });
    await name.fill("Matbudsjett høst");
    await name.press("Enter");

    await expect(
      page.locator("[data-sonner-toast]", {
        hasText: "Samtalen fikk nytt navn",
      }),
    ).toBeVisible();
    const threads = page.getByRole("navigation", { name: "Samtaler" });
    await expect(
      threads.getByRole("link", { name: /Matbudsjett høst/ }),
    ).toBeVisible();

    await page.reload();

    await expect(
      threads.getByRole("link", { name: /Matbudsjett høst/ }),
    ).toBeVisible();
    await expect(
      threads.getByRole("link", { name: /Dagligvarer i september/ }),
    ).toHaveCount(0);
  },
);

test(
  "deletes the open conversation and starts a fresh one",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [],
      transactions: [],
      assistantThreads: [THREAD, OTHER_THREAD],
    });

    await page.goto(`/assistant?thread=${THREAD.id}`);
    await page
      .getByRole("button", { name: "Valg for Dagligvarer i september" })
      .click();
    await page.getByRole("menuitem", { name: "Slett" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "Slette samtalen?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Slett", exact: true }).click();

    await expect(
      page.locator("[data-sonner-toast]", { hasText: "Samtalen ble slettet" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/assistant$/);
    await expect(page.getByText(ANSWER)).toHaveCount(0);

    await page.reload();

    const threads = page.getByRole("navigation", { name: "Samtaler" });
    await expect(
      threads.getByRole("link", { name: /Restaurantbesøk/ }),
    ).toBeVisible();
    await expect(
      threads.getByRole("link", { name: /Dagligvarer i september/ }),
    ).toHaveCount(0);
  },
);

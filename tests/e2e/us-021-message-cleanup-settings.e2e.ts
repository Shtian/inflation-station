import { expect, type Page, test } from "@playwright/test";

async function stubMonthlyReviewSettings(page: Page) {
  await page.route("**/api/monthly-review/system-prompt", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        promptText: "",
        resolvedPrompt: "You are a financial review assistant.",
        usesDefaultPrompt: true,
        modelId: null,
        resolvedModelId: "gpt-5.4-mini",
        usesDefaultModel: true,
        availableModels: ["gpt-5.4-mini"],
        availableModelsSource: "openai",
      }),
    });
  });
}

function importSection(page: Page) {
  return page.getByRole("region", { name: "Import", exact: true });
}

test("submits message cleanup settings through a server action", async ({
  page,
}) => {
  let serverActionRequestCount = 0;

  const availableModels = ["gpt-4o-mini", "gpt-5.2"];

  const availableReasoningEfforts = [
    {
      id: "none",
      label: "Ingen",
      description:
        "Raskest, men kan stille droppe forslag på enkelte modeller.",
    },
    {
      id: "low",
      label: "Lav",
      description:
        "Standard. Beholder alle forslag, omtrent 30 % raskere enn uten overstyring.",
    },
    {
      id: "medium",
      label: "Middels",
      description: "Balanserer grundighet og fart for vanlige ryddekjøringer.",
    },
    {
      id: "high",
      label: "Høy",
      description:
        "Resonnerer grundigere før svaret, i et merkbart lavere tempo.",
    },
    {
      id: "xhigh",
      label: "Ekstra høy",
      description: "Tregest, med den grundigste resonneringen.",
    },
  ];

  await page.route("**/api/imports/message-cleanup-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        promptText: "Trim transaction noise.",
        resolvedPrompt: "Trim transaction noise.",
        usesDefaultPrompt: false,
        modelId: "gpt-5.2",
        resolvedModelId: "gpt-5.2",
        usesDefaultModel: false,
        availableModels,
        availableModelsSource: "openai",
        reasoningEffort: "low",
        resolvedReasoningEffort: "low",
        usesDefaultReasoningEffort: true,
        availableReasoningEfforts,
      }),
    });
  });

  await page.route("**/settings", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      Object.hasOwn(request.headers(), "next-action")
    ) {
      serverActionRequestCount += 1;
    }

    await route.fallback();
  });

  await stubMonthlyReviewSettings(page);
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: "Import", exact: true }),
  ).toBeVisible();

  const systemPromptTextbox = page.getByLabel(
    "Systemprompt for meldingsrydding",
  );
  await expect(systemPromptTextbox).toHaveValue("Trim transaction noise.");

  const reasoningEffortCombobox = page.getByRole("combobox", {
    name: "Resonneringsnivå for meldingsrydding",
  });
  await expect(reasoningEffortCombobox).toBeVisible();
  await expect(
    reasoningEffortCombobox.locator("[data-slot=select-value]"),
  ).toHaveText("Lav");

  await systemPromptTextbox.fill("Keep merchant + location only.");
  await importSection(page)
    .getByRole("button", { name: "Lagre prompt" })
    .click();

  await expect.poll(() => serverActionRequestCount).toBe(1);
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Systemprompt lagret." }),
  ).toBeVisible();
  await expect(
    importSection(page).getByRole("button", { name: "Lagre prompt" }),
  ).toBeEnabled();

  await reasoningEffortCombobox.click();
  await page.getByRole("option", { name: "Høy", exact: true }).click();

  await expect.poll(() => serverActionRequestCount).toBe(2);
  await expect(
    page.locator("[data-sonner-toast]", {
      hasText: "Resonneringsnivå for rydding lagret.",
    }),
  ).toBeVisible();
  await expect(
    reasoningEffortCombobox.locator("[data-slot=select-value]"),
  ).toHaveText("Høy");
});

test("shows stable save failure feedback when message cleanup action fails", async ({
  page,
}) => {
  let serverActionRequestCount = 0;

  await page.route("**/api/imports/message-cleanup-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        promptText: "Trim transaction noise.",
        resolvedPrompt: "Trim transaction noise.",
        usesDefaultPrompt: false,
        modelId: "gpt-5.2",
        resolvedModelId: "gpt-5.2",
        usesDefaultModel: false,
        availableModels: ["gpt-5.2"],
        availableModelsSource: "openai",
        reasoningEffort: "low",
        resolvedReasoningEffort: "low",
        usesDefaultReasoningEffort: true,
        availableReasoningEfforts: [
          {
            id: "none",
            label: "Ingen",
            description:
              "Raskest, men kan stille droppe forslag på enkelte modeller.",
          },
          {
            id: "low",
            label: "Lav",
            description:
              "Standard. Beholder alle forslag, omtrent 30 % raskere enn uten overstyring.",
          },
          {
            id: "medium",
            label: "Middels",
            description:
              "Balanserer grundighet og fart for vanlige ryddekjøringer.",
          },
          {
            id: "high",
            label: "Høy",
            description:
              "Resonnerer grundigere før svaret, i et merkbart lavere tempo.",
          },
          {
            id: "xhigh",
            label: "Ekstra høy",
            description: "Tregest, med den grundigste resonneringen.",
          },
        ],
      }),
    });
  });

  await page.route("**/settings", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      Object.hasOwn(request.headers(), "next-action")
    ) {
      serverActionRequestCount += 1;
      await route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "forced action failure",
      });
      return;
    }

    await route.fallback();
  });

  await stubMonthlyReviewSettings(page);
  await page.goto("/settings");

  await page
    .getByLabel("Systemprompt for meldingsrydding")
    .fill("Keep merchant + location only.");
  await importSection(page)
    .getByRole("button", { name: "Lagre prompt" })
    .click();

  await expect.poll(() => serverActionRequestCount).toBe(1);
  await expect(
    page.getByText(
      "Kunne ikke lagre innstillingene for meldingsrydding. Prøv igjen.",
    ),
  ).toBeVisible();
  await expect(
    importSection(page).getByRole("button", { name: "Lagre prompt" }),
  ).toBeEnabled();
});

test("explains when OpenAI models could not be loaded", async ({ page }) => {
  await page.route("**/api/imports/message-cleanup-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        promptText: "",
        resolvedPrompt: "Default prompt.",
        usesDefaultPrompt: true,
        modelId: "gpt-6-luna",
        resolvedModelId: "gpt-6-luna",
        usesDefaultModel: false,
        availableModels: ["gpt-6-luna", "gpt-5.6-luna"],
        availableModelsSource: "unavailable",
        reasoningEffort: null,
        resolvedReasoningEffort: "low",
        usesDefaultReasoningEffort: true,
        availableReasoningEfforts: [
          { id: "low", label: "Lav", description: "Standard." },
        ],
      }),
    });
  });

  await stubMonthlyReviewSettings(page);
  await page.goto("/settings");

  const modelCombobox = page.getByRole("combobox", {
    name: "OpenAI-modell for meldingsrydding",
  });
  await expect(modelCombobox.locator("[data-slot=select-value]")).toHaveText(
    "gpt-6-luna",
  );
  await expect(
    page.getByText(
      "Kunne ikke laste inn modeller fra OpenAI. Viser bare den lagrede modellen.",
    ),
  ).toBeVisible();
});

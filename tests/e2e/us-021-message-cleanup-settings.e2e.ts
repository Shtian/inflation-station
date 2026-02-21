import { expect, test } from "@playwright/test";

test("submits message cleanup settings through a server action", async ({
  page,
}) => {
  let serverActionRequestCount = 0;

  const availableModels = [
    {
      id: "gpt-4o-mini",
      label: "GPT-4o Mini",
      description: "Low-cost baseline model.",
      tier: "cheap",
    },
    {
      id: "gpt-5.2",
      label: "GPT-5.2",
      description: "Balanced quality and cost.",
      tier: "balanced",
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
      }),
    });
  });

  await page.route("**/import/settings/message-cleanup", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      Object.hasOwn(request.headers(), "next-action")
    ) {
      serverActionRequestCount += 1;
    }

    await route.fallback();
  });

  await page.goto("/import/settings/message-cleanup");

  await expect(
    page.getByRole("heading", { name: "Message Cleanup Settings" }),
  ).toBeVisible();

  const systemPromptTextbox = page.getByLabel("Message cleanup system prompt");
  await expect(systemPromptTextbox).toHaveValue("Trim transaction noise.");

  await systemPromptTextbox.fill("Keep merchant + location only.");
  await page.getByRole("button", { name: "Save prompt" }).click();

  await expect.poll(() => serverActionRequestCount).toBe(1);
  await expect(page.getByRole("button", { name: "Save prompt" })).toBeEnabled();
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
        availableModels: [
          {
            id: "gpt-5.2",
            label: "GPT-5.2",
            description: "Balanced quality and cost.",
            tier: "balanced",
          },
        ],
      }),
    });
  });

  await page.route("**/import/settings/message-cleanup", async (route) => {
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

  await page.goto("/import/settings/message-cleanup");

  await page
    .getByLabel("Message cleanup system prompt")
    .fill("Keep merchant + location only.");
  await page.getByRole("button", { name: "Save prompt" }).click();

  await expect.poll(() => serverActionRequestCount).toBe(1);
  await expect(
    page.getByText(
      "Could not save message cleanup settings. Please try again.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save prompt" })).toBeEnabled();
});

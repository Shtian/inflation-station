import { expect, type Page, test } from "@playwright/test";

const QUESTION = "Hvor mye brukte jeg på dagligvarer forrige måned?";
const ANSWER =
  "Fra 2026-09-01 til 2026-09-30 brukte du 4 250 kr på Dagligvarer.";

function sse(chunks: unknown[]): string {
  return [...chunks.map((chunk) => JSON.stringify(chunk)), "[DONE]"]
    .map((data) => `data: ${data}\n\n`)
    .join("");
}

async function stubAssistant(
  page: Page,
  { disabledReason }: { disabledReason: "key_missing" | null },
) {
  await page.route("**/api/assistant/chat", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { disabledReason } });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: sse([
        { type: "start" },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: ANSWER.slice(0, 20) },
        { type: "text-delta", id: "text-1", delta: ANSWER.slice(20) },
        { type: "text-end", id: "text-1" },
        { type: "finish" },
      ]),
    });
  });
}

test("explains that the chat needs an API key when the server has none", async ({
  page,
}) => {
  await stubAssistant(page, { disabledReason: "key_missing" });

  await page.goto("/assistant");

  await expect(page.getByRole("heading", { name: "Spør" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chatten er ikke tilgjengelig" }),
  ).toBeVisible();
  await expect(page.getByText("OPENAI_API_KEY")).toBeVisible();
  await expect(page.getByRole("button", { name: QUESTION })).toHaveCount(0);
});

test("shows example questions in an empty conversation", async ({ page }) => {
  await stubAssistant(page, { disabledReason: null });

  await page.goto("/assistant");

  await expect(page.getByRole("button", { name: QUESTION })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Skriv et spørsmål" }),
  ).toBeVisible();
});

test("streams an answer to an example question into the conversation", async ({
  page,
}) => {
  await stubAssistant(page, { disabledReason: null });

  await page.goto("/assistant");
  await page.getByRole("button", { name: QUESTION }).click();

  const conversation = page.getByRole("region", {
    name: "Samtale om forbruket ditt",
  });
  await expect(conversation.getByText(QUESTION)).toBeVisible();
  await expect(conversation.getByText(ANSWER)).toBeVisible();
  await expect(page.getByRole("button", { name: QUESTION })).toHaveCount(0);
});

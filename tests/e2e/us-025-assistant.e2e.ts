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

  await expect(page.getByRole("heading", { name: "Innsikt" })).toBeVisible();
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

async function holdAssistantStream(page: Page) {
  await page.addInitScript(() => {
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.includes("/api/assistant/chat") || init?.method !== "POST") {
        return originalFetch(input, init);
      }
      const body = new ReadableStream<Uint8Array>({
        start(streamController) {
          controller = streamController;
        },
      });
      return Promise.resolve(
        new Response(body, {
          headers: {
            "content-type": "text/event-stream",
            "x-vercel-ai-ui-message-stream": "v1",
          },
        }),
      );
    };
    Object.assign(window, {
      pushAssistantChunks(chunks: unknown[]) {
        for (const chunk of chunks) {
          controller?.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
          );
        }
      },
      closeAssistantStream() {
        controller?.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller?.close();
      },
    });
  });
}

function pushChunks(page: Page, chunks: unknown[]) {
  return page.evaluate((pending) => {
    (
      window as unknown as { pushAssistantChunks: (c: unknown[]) => void }
    ).pushAssistantChunks(pending);
  }, chunks);
}

test("keeps one status line visible until the answer text streams", async ({
  page,
}) => {
  await stubAssistant(page, { disabledReason: null });
  await holdAssistantStream(page);

  await page.goto("/assistant");
  await page.getByRole("button", { name: QUESTION }).click();

  const conversation = page.getByRole("region", {
    name: "Samtale om forbruket ditt",
  });
  const thinking = conversation.getByText("Tenker…");
  const fetching = conversation.getByText("Henter tall…");

  await expect(thinking).toBeVisible();
  await expect(fetching).toHaveCount(0);

  await pushChunks(page, [
    { type: "start" },
    { type: "start-step" },
    {
      type: "tool-input-start",
      toolCallId: "call-1",
      toolName: "summarizeSpending",
    },
    {
      type: "tool-input-available",
      toolCallId: "call-1",
      toolName: "summarizeSpending",
      input: { from: "2026-09-01", to: "2026-09-30", groupBy: "category" },
    },
  ]);
  await expect(fetching).toBeVisible();
  await expect(thinking).toHaveCount(0);

  await pushChunks(page, [
    { type: "tool-output-available", toolCallId: "call-1", output: [] },
    { type: "finish-step" },
  ]);
  await expect(thinking).toBeVisible();
  await expect(fetching).toHaveCount(0);

  await pushChunks(page, [
    { type: "start-step" },
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: ANSWER },
  ]);
  await expect(conversation.getByText(ANSWER)).toBeVisible();
  await expect(thinking).toHaveCount(0);
  await expect(fetching).toHaveCount(0);

  await pushChunks(page, [
    { type: "text-end", id: "text-1" },
    { type: "finish-step" },
    { type: "finish" },
  ]);
  await page.evaluate(() => {
    (
      window as unknown as { closeAssistantStream: () => void }
    ).closeAssistantStream();
  });
  await expect(
    page.getByRole("button", { name: "Send melding" }),
  ).toBeVisible();
  await expect(thinking).toHaveCount(0);
  await expect(fetching).toHaveCount(0);
});

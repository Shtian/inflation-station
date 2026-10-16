import { expect, type Page, test } from "@playwright/test";

const QUESTION = "Hvor mye brukte jeg på dagligvarer forrige måned?";
const ANSWER =
  "Fra 2026-09-01 til 2026-09-30 brukte du 4 250 kr på Dagligvarer.";

function sse(chunks: unknown[]): string {
  return [...chunks.map((chunk) => JSON.stringify(chunk)), "[DONE]"]
    .map((data) => `data: ${data}\n\n`)
    .join("");
}

const ANSWER_CHUNKS = [
  { type: "text-start", id: "text-1" },
  { type: "text-delta", id: "text-1", delta: ANSWER.slice(0, 20) },
  { type: "text-delta", id: "text-1", delta: ANSWER.slice(20) },
  { type: "text-end", id: "text-1" },
];

async function stubAssistant(
  page: Page,
  {
    disabledReason,
    toolChunks = [],
  }: { disabledReason: "key_missing" | null; toolChunks?: unknown[] },
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
        ...toolChunks,
        ...ANSWER_CHUNKS,
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

test("links a finished answer to the transactions its tool call looked at", async ({
  page,
  context,
}) => {
  const input = {
    from: "2026-09-01",
    to: "2026-09-30",
    groupBy: "category",
    categoryIds: ["cat-food"],
  };
  await stubAssistant(page, {
    disabledReason: null,
    toolChunks: [
      {
        type: "tool-input-available",
        toolCallId: "call-1",
        toolName: "summarizeSpending",
        input,
      },
      {
        type: "tool-output-available",
        toolCallId: "call-1",
        output: {
          range: { from: input.from, to: input.to },
          filters: {
            categoryIds: input.categoryIds,
            accountIds: [],
            merchantQuery: null,
          },
          groupBy: "category",
          totalSpendNok: 4250,
          transactionCount: 12,
          groups: [],
        },
      },
    ],
  });
  const transactionRequests: URL[] = [];
  await context.route("**/api/accounts", (route) =>
    route.fulfill({ json: { accounts: [] } }),
  );
  await context.route("**/api/categories", (route) =>
    route.fulfill({ json: { categories: [] } }),
  );
  await context.route("**/api/transactions**", async (route, request) => {
    transactionRequests.push(new URL(request.url()));
    await route.fulfill({
      json: {
        rows: [],
        pagination: { total: 0, page: 1, pageSize: 25, totalPages: 1 },
      },
    });
  });

  await page.goto("/assistant");
  await page.getByRole("button", { name: QUESTION }).click();

  const conversation = page.getByRole("region", {
    name: "Samtale om forbruket ditt",
  });
  await expect(conversation.getByText(ANSWER)).toBeVisible();
  const link = conversation.getByRole("link", {
    name: "Se transaksjonene · 1.–30. sep. 2026",
  });
  await expect(link).toHaveAttribute(
    "href",
    "/transactions?page=1&pageSize=25&dateFrom=2026-09-01&dateTo=2026-09-30&categoryId=cat-food",
  );
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");

  const popupPromise = page.waitForEvent("popup");
  await link.click();
  const popup = await popupPromise;

  await expect(popup).toHaveURL(
    /\/transactions\?page=1&pageSize=25&dateFrom=2026-09-01&dateTo=2026-09-30&categoryId=cat-food$/,
  );
  await expect
    .poll(() =>
      transactionRequests.some(
        (url) =>
          url.searchParams.get("dateFrom") === "2026-09-01" &&
          url.searchParams.get("dateTo") === "2026-09-30" &&
          url.searchParams.get("categoryId") === "cat-food",
      ),
    )
    .toBe(true);
});

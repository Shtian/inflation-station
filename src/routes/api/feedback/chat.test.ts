import type { ModelMessage } from "@tanstack/ai";
import {
  ChatClient,
  fetchServerSentEvents,
  type UIMessage,
} from "@tanstack/ai-react";
import { fakeText } from "@tanstack/ai/testing";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { createGithubIssueTool } from "@/lib/feedback/agent";
import { routeHandler } from "../-route-handler";
import { stubConfig } from "../../../../tests/support/config-env";
import { Route } from "./chat";

const POST = routeHandler(Route, "POST");

const { model } = vi.hoisted(() => ({
  model: { current: undefined as unknown },
}));

vi.mock("@tanstack/ai-openai", () => ({
  createOpenaiChat: () => model.current,
}));

const ENDPOINT = "http://localhost/api/feedback/chat";

function post(body: string) {
  return POST(
    new Request(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
  );
}

describe("POST /api/feedback/chat", () => {
  beforeEach(() => {
    stubConfig({
      OPENAI_API_KEY: "test-key",
      FEEDBACK_GITHUB_REPO: "Shtian/inflation-station",
      FEEDBACK_GITHUB_TOKEN: "github_pat_test",
    });
  });

  it("answers 503 key_missing when there is no API key", async () => {
    stubConfig({ OPENAI_API_KEY: undefined });

    const response = await post(JSON.stringify({ messages: [] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "FEEDBACK_UNAVAILABLE",
      reason: "key_missing",
    });
  });

  it("answers 503 repo_missing when the repo is unset", async () => {
    stubConfig({ FEEDBACK_GITHUB_REPO: undefined });

    const response = await post(JSON.stringify({ messages: [] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "FEEDBACK_UNAVAILABLE",
      reason: "repo_missing",
    });
  });

  it("answers 503 token_missing when the GitHub token is unset", async () => {
    stubConfig({ FEEDBACK_GITHUB_TOKEN: undefined });

    const response = await post(JSON.stringify({ messages: [] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "FEEDBACK_UNAVAILABLE",
      reason: "token_missing",
    });
  });

  it("answers 400 when the body is not JSON", async () => {
    const response = await post("not json");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_FEEDBACK_MESSAGES",
      message: "Forespørselen må være JSON.",
    });
  });

  it("answers 400 when the body is not a chat request", async () => {
    const response = await post(
      JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_FEEDBACK_MESSAGES",
    });
  });

  it("answers 400 when user metadata breaks the schema", async () => {
    const response = await post(
      JSON.stringify({
        threadId: "thread-1",
        runId: "run-1",
        tools: [],
        context: [],
        messages: [
          {
            id: "u1",
            role: "user",
            content: "Broken",
            metadata: { pathname: 42 },
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_FEEDBACK_MESSAGES",
    });
  });
});

const SAVE_BUTTON = {
  selector: '[data-testid="save-transaction"]',
  tagName: "button",
  label: "save-transaction",
  text: "Lagre",
  html: '<button data-testid="save-transaction">Lagre</button>',
};

const DRAFT = {
  kind: "bug",
  title: "Save button does nothing",
  body: "## What happened\nNothing.",
};

const REPORT = {
  content: "Knappen gjør ingenting",
  metadata: { pathname: "/transactions", element: SAVE_BUTTON },
};

type ModelStep =
  | { text: string }
  | { draft: typeof DRAFT }
  | { fail: string }
  | { throws: string };

function scriptModel(steps: ModelStep[]) {
  const seen: string[][] = [];
  const fake = fakeText();
  fake.setResponses(
    steps.map((step) => ({ request }) => {
      seen.push(textOf(request.messages));
      if ("fail" in step) {
        return { error: step.fail };
      }
      if ("throws" in step) {
        throw new Error(step.throws);
      }
      return "text" in step
        ? { text: step.text }
        : {
            toolCalls: [
              { name: "createGithubIssue", input: step.draft, id: "call-1" },
            ],
          };
    }),
  );
  model.current = fake;
  return seen;
}

function textOf(messages: ReadonlyArray<ModelMessage>): string[] {
  return messages
    .map((message) => {
      const content =
        typeof message.content === "string"
          ? [message.content]
          : (message.content ?? []).flatMap((part) =>
              part.type === "text" ? [part.content] : [],
            );
      const calls = (message.toolCalls ?? []).map(
        (call) => `call ${call.function.name}`,
      );
      return [...content, ...calls].filter(Boolean).join("\n");
    })
    .filter(Boolean);
}

function startChat() {
  return new ChatClient({
    threadId: "thread-1",
    connection: fetchServerSentEvents(ENDPOINT, {
      fetchClient: (input, init) =>
        POST(new Request(input as string | URL, init)),
    }),
    tools: [createGithubIssueTool],
  });
}

function pendingDraft(client: ReturnType<typeof startChat>) {
  const approval = client
    .getInterrupts()
    .find((interrupt) => interrupt.kind === "tool-approval");
  if (!approval) {
    throw new Error("No draft awaits approval");
  }
  return approval;
}

function shown(messages: UIMessage[]): string {
  return JSON.stringify(messages);
}

function stubGithub(response: Response) {
  const requests: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (!url.startsWith("https://api.github.com/")) {
        throw new Error(`Unexpected fetch ${url}`);
      }
      requests.push(JSON.parse(String(init.body)));
      return response.clone();
    }),
  );
  return requests;
}

const CREATED = new Response(
  JSON.stringify({
    number: 42,
    html_url: "https://github.com/Shtian/inflation-station/issues/42",
  }),
  { status: 201 },
);

describe("POST /api/feedback/chat conversation", () => {
  beforeEach(() => {
    stubConfig({
      OPENAI_API_KEY: "test-key",
      FEEDBACK_GITHUB_REPO: "Shtian/inflation-station",
      FEEDBACK_GITHUB_TOKEN: "github_pat_test",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the model the page and element the user reported from", async () => {
    const seen = scriptModel([{ text: "Hva forventet du?" }]);
    const client = startChat();

    await client.sendMessage(REPORT);

    expect(shown(client.getMessages())).toContain("Hva forventet du?");
    expect(seen).toEqual([
      [
        '[Page: /transactions]\n[Selected element: [data-testid="save-transaction"] | <button> | label: save-transaction | text: "Lagre" | html: <button data-testid="save-transaction">Lagre</button>]\nKnappen gjør ingenting',
      ],
    ]);
  });

  it("creates the issue only after the user approves the draft", async () => {
    const github = stubGithub(CREATED);
    scriptModel([{ draft: DRAFT }, { text: "Saken er opprettet." }]);
    const client = startChat();

    await client.sendMessage(REPORT);

    expect(shown(client.getMessages())).toContain("Save button does nothing");
    expect(github).toEqual([]);

    pendingDraft(client).resolveInterrupt(true, {});

    await vi.waitFor(() =>
      expect(shown(client.getMessages())).toContain(
        "https://github.com/Shtian/inflation-station/issues/42",
      ),
    );
    expect(github).toEqual([
      {
        title: "Save button does nothing",
        body: [
          "## What happened",
          "Nothing.",
          "",
          "## Context",
          "",
          "**Pages**",
          "- `/transactions`",
          "",
          "**Selected elements**",
          '- `[data-testid="save-transaction"]` — "Lagre"',
          "",
          "  ```html",
          '  <button data-testid="save-transaction">Lagre</button>',
          "  ```",
          "",
          "_Submitted via in-app feedback._",
        ].join("\n"),
        labels: ["bug", "needs-triage"],
      },
    ]);
  });

  it("tells the model why the user declined the draft", async () => {
    const github = stubGithub(CREATED);
    const seen = scriptModel([{ draft: DRAFT }, { text: "Hva vil du endre?" }]);
    const client = startChat();

    await client.sendMessage(REPORT);
    pendingDraft(client).resolveInterrupt(false, {
      payload: { reason: "Not yet." },
    });

    await vi.waitFor(() => expect(seen).toHaveLength(2));
    expect(github).toEqual([]);
    expect(seen[1]?.at(-1)).toContain("Not yet.");
  });

  it("treats a typed reply to a pending draft as a decline", async () => {
    const seen = scriptModel([
      { draft: DRAFT },
      { text: "Jeg legger til Excel." },
    ]);
    const client = startChat();

    await client.sendMessage(REPORT);
    client.stop();
    await client.sendMessage({
      content: "Nevn Excel også",
      metadata: { pathname: "/transactions" },
    });

    expect(seen[1]?.slice(1)).toEqual([
      "call createGithubIssue",
      "The user replied with more feedback instead of approving this draft.",
      "[Page: /transactions]\nNevn Excel også",
    ]);
  });

  it("shows GitHub failures to the user", async () => {
    stubGithub(
      new Response(JSON.stringify({ message: "Validation Failed" }), {
        status: 422,
      }),
    );
    scriptModel([{ draft: DRAFT }, { text: "Det feilet." }]);
    const client = startChat();

    await client.sendMessage(REPORT);
    pendingDraft(client).resolveInterrupt(true, {});

    await vi.waitFor(() =>
      expect(shown(client.getMessages())).toContain(
        "Kunne ikke opprette GitHub-saken: 422 Validation Failed",
      ),
    );
  });

  it.each([
    ["reports", { fail: "upstream secret detail" }],
    ["throws", { throws: "upstream secret detail" }],
  ] as const)(
    "hides an error the provider %s behind a generic message",
    async (_label, step) => {
      scriptModel([step]);
      vi.spyOn(console, "error").mockImplementation(() => {});
      const client = startChat();

      await client.sendMessage(REPORT);

      expect(client.getError()?.message).toBe(
        "Tilbakemeldingsassistenten fikk et problem.",
      );
      expect(shown(client.getMessages())).not.toContain(
        "upstream secret detail",
      );
    },
  );
});

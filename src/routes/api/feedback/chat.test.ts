import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { routeHandler } from "../-route-handler";
import { stubConfig } from "../../../../tests/support/config-env";
import { Route } from "./chat";

const POST = routeHandler(Route, "POST");

const { model } = vi.hoisted(() => ({
  model: { current: undefined as unknown },
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => ({ chat: () => model.current }),
}));

function post(body: string) {
  return POST(
    new Request("http://localhost/api/feedback/chat", {
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

  it("answers 400 when messages are not UI messages", async () => {
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
        messages: [
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "Broken" }],
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
  id: "u1",
  role: "user",
  parts: [{ type: "text", text: "Knappen gjør ingenting" }],
  metadata: { pathname: "/transactions", element: SAVE_BUTTON },
};

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

type ModelStep = { text: string } | { draft: typeof DRAFT } | { fail: string };

function streamFor(step: ModelStep) {
  if ("fail" in step) {
    throw new Error(step.fail);
  }
  const body =
    "text" in step
      ? [
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: step.text },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: USAGE,
          },
        ]
      : [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "createGithubIssue",
            input: JSON.stringify(step.draft),
          },
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: "tool_calls" },
            usage: USAGE,
          },
        ];
  return simulateReadableStream({
    chunks: [{ type: "stream-start", warnings: [] }, ...body],
  });
}

// Scripts one model reply per call and records the text each call was shown,
// one string per message, so assertions stay independent of the SDK's prompt shape.
function scriptModel(steps: ModelStep[]) {
  const seen: string[][] = [];
  model.current = new MockLanguageModelV3({
    doStream: async ({ prompt }) => {
      seen.push(textOf(prompt));
      const step = steps[seen.length - 1];
      if (!step) {
        throw new Error("No scripted model reply left");
      }
      return { stream: streamFor(step) as never };
    },
  });
  return seen;
}

function textOf(
  prompt: ReadonlyArray<{ role: string; content: unknown }>,
): string[] {
  return prompt
    .filter((message) => message.role !== "system")
    .map((message) =>
      (message.content as Array<Record<string, unknown>>)
        .map((part) => {
          if (part.type === "text") {
            return part.text;
          }
          if (part.type === "tool-call") {
            return `call ${part.toolName}`;
          }
          if (part.type === "tool-result") {
            const output = part.output as { value?: unknown; reason?: string };
            if (output.reason !== undefined) {
              return output.reason;
            }
            return typeof output.value === "string"
              ? output.value
              : JSON.stringify(output.value);
          }
          return "";
        })
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean);
}

function draftAwaitingApproval(approval?: { approved: boolean; reason?: string }) {
  return {
    id: "a1",
    role: "assistant",
    parts: [
      approval
        ? {
            type: "tool-createGithubIssue",
            toolCallId: "call-1",
            state: "approval-responded",
            input: DRAFT,
            approval: { id: "approval-1", ...approval },
          }
        : {
            type: "tool-createGithubIssue",
            toolCallId: "call-1",
            state: "approval-requested",
            input: DRAFT,
            approval: { id: "approval-1" },
          },
    ],
  };
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

    const response = await post(JSON.stringify({ messages: [REPORT] }));

    expect(await response.text()).toContain("Hva forventet du?");
    expect(seen).toEqual([
      [
        '[Page: /transactions]\n[Selected element: [data-testid="save-transaction"] | <button> | label: save-transaction | text: "Lagre" | html: <button data-testid="save-transaction">Lagre</button>]\nKnappen gjør ingenting',
      ],
    ]);
  });

  it("creates the issue only after the user approves the draft", async () => {
    const github = stubGithub(CREATED);
    scriptModel([{ draft: DRAFT }]);

    const proposal = await post(JSON.stringify({ messages: [REPORT] }));

    expect(await proposal.text()).toContain("Save button does nothing");
    expect(github).toEqual([]);

    scriptModel([{ text: "Saken er opprettet." }]);
    const approval = await post(
      JSON.stringify({
        messages: [REPORT, draftAwaitingApproval({ approved: true })],
      }),
    );

    expect(await approval.text()).toContain(
      "https://github.com/Shtian/inflation-station/issues/42",
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
    const seen = scriptModel([{ text: "Hva vil du endre?" }]);

    const response = await post(
      JSON.stringify({
        messages: [
          REPORT,
          draftAwaitingApproval({ approved: false, reason: "Not yet." }),
        ],
      }),
    );
    await response.text();

    expect(github).toEqual([]);
    expect(seen[0]?.at(-1)).toBe("Not yet.");
  });

  it("treats a typed reply to a pending draft as a decline", async () => {
    const seen = scriptModel([{ text: "Jeg legger til Excel." }]);

    const response = await post(
      JSON.stringify({
        messages: [
          REPORT,
          draftAwaitingApproval(),
          {
            id: "u2",
            role: "user",
            parts: [{ type: "text", text: "Nevn Excel også" }],
            metadata: { pathname: "/transactions" },
          },
        ],
      }),
    );
    await response.text();

    expect(seen[0]?.slice(1)).toEqual([
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
    scriptModel([{ text: "Det feilet." }]);

    const response = await post(
      JSON.stringify({
        messages: [REPORT, draftAwaitingApproval({ approved: true })],
      }),
    );

    expect(await response.text()).toContain(
      "Kunne ikke opprette GitHub-saken: 422 Validation Failed",
    );
  });

  it("hides provider errors behind a generic message", async () => {
    scriptModel([{ fail: "upstream secret detail" }]);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post(JSON.stringify({ messages: [REPORT] }));
    const text = await response.text();

    expect(text).toContain("Tilbakemeldingsassistenten fikk et problem.");
    expect(text).not.toContain("upstream secret detail");
  });
});

import { describe, expect, it, vi } from "vite-plus/test";
import {
  createFeedbackTools,
  formatIssueBody,
  resolveFeedbackDisabledReason,
  toModelMessages,
} from "./agent";
import type { FeedbackUIMessage, PickedElement } from "./contract";

const saveButton: PickedElement = {
  selector: '[data-testid="save-transaction"]',
  tagName: "button",
  label: "save-transaction",
  text: "Lagre",
  html: '<button data-testid="save-transaction">Lagre</button>',
};

function userMessage(
  id: string,
  text: string,
  metadata?: FeedbackUIMessage["metadata"],
): FeedbackUIMessage {
  return { id, role: "user", parts: [{ type: "text", text }], metadata };
}

function assistantMessage(id: string, text: string): FeedbackUIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

describe("resolveFeedbackDisabledReason", () => {
  it("is enabled with a key and an owner/name repo", () => {
    expect(
      resolveFeedbackDisabledReason({
        OPENAI_API_KEY: "sk-test",
        FEEDBACK_GITHUB_REPO: " Shtian/inflation-station ",
      }),
    ).toBeNull();
  });

  it("reports key_missing before checking the repo", () => {
    expect(
      resolveFeedbackDisabledReason({
        OPENAI_API_KEY: "  ",
        FEEDBACK_GITHUB_REPO: "",
      }),
    ).toBe("key_missing");
  });

  it("reports repo_missing when the repo is unset or not owner/name", () => {
    expect(resolveFeedbackDisabledReason({ OPENAI_API_KEY: "sk-test" })).toBe(
      "repo_missing",
    );
    expect(
      resolveFeedbackDisabledReason({
        OPENAI_API_KEY: "sk-test",
        FEEDBACK_GITHUB_REPO: "https://github.com/Shtian/inflation-station",
      }),
    ).toBe("repo_missing");
  });
});

describe("toModelMessages", () => {
  it("prefixes user messages with page and selected element context", async () => {
    const messages = await toModelMessages([
      userMessage("u1", "Knappen gjør ingenting", {
        pathname: "/transactions?month=2026-09",
        element: saveButton,
      }),
      assistantMessage("a1", "Hva forventet du skulle skje?"),
      userMessage("u2", "At den lagrer", { pathname: "/transactions" }),
    ]);

    expect(messages).toEqual([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: '[Page: /transactions?month=2026-09]\n[Selected element: [data-testid="save-transaction"] | <button> | label: save-transaction | text: "Lagre" | html: <button data-testid="save-transaction">Lagre</button>]',
          },
          { type: "text", text: "Knappen gjør ingenting" },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Hva forventet du skulle skje?" }],
      },
      {
        role: "user",
        content: [
          { type: "text", text: "[Page: /transactions]" },
          { type: "text", text: "At den lagrer" },
        ],
      },
    ]);
  });

  it("sends a draft the user replied to instead of approving as denied", async () => {
    const messages = await toModelMessages([
      userMessage("u1", "Add CSV export", { pathname: "/" }),
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-createGithubIssue",
            toolCallId: "call-1",
            state: "approval-requested",
            input: {
              kind: "feature",
              title: "Export transactions as CSV",
              body: "## Proposed idea\nExport button.",
            },
            approval: { id: "approval-1" },
          },
        ],
      },
      userMessage("u2", "Mention Excel too", { pathname: "/" }),
    ]);

    expect(messages[1]).toEqual({
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "createGithubIssue",
          input: {
            kind: "feature",
            title: "Export transactions as CSV",
            body: "## Proposed idea\nExport button.",
          },
        },
        {
          type: "tool-approval-request",
          approvalId: "approval-1",
          toolCallId: "call-1",
        },
      ],
    });
    expect(messages[2]).toEqual({
      role: "tool",
      content: [
        {
          type: "tool-approval-response",
          approvalId: "approval-1",
          approved: false,
          reason:
            "The user replied with more feedback instead of approving this draft.",
        },
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "createGithubIssue",
          output: {
            type: "error-text",
            value:
              "The user replied with more feedback instead of approving this draft.",
          },
        },
      ],
    });
  });
});

describe("formatIssueBody", () => {
  it("appends distinct pages and picked elements as context", () => {
    const body = formatIssueBody(
      {
        kind: "bug",
        title: "Save does nothing",
        body: "## What happened\nNothing.\n",
      },
      [
        userMessage("u1", "Broken", {
          pathname: "/transactions",
          element: saveButton,
        }),
        assistantMessage("a1", "Where?"),
        userMessage("u2", "Here too", {
          pathname: "/transactions",
          element: saveButton,
        }),
        userMessage("u3", "And here", { pathname: "/accounts" }),
      ],
    );

    expect(body).toBe(
      [
        "## What happened",
        "Nothing.",
        "",
        "## Context",
        "",
        "**Pages**",
        "- `/transactions`",
        "- `/accounts`",
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
    );
  });

  it("uses a longer fence when the html contains backticks", () => {
    const body = formatIssueBody(
      { kind: "bug", title: "Code block", body: "## What happened\nOdd." },
      [
        userMessage("u1", "Look", {
          pathname: "/",
          element: { ...saveButton, text: "", html: "<pre>```</pre>" },
        }),
      ],
    );

    expect(body).toContain(
      '- `[data-testid="save-transaction"]`\n\n  ````html\n  <pre>```</pre>\n  ````',
    );
  });

  it("omits the context section when no message has metadata", () => {
    expect(
      formatIssueBody(
        {
          kind: "feature",
          title: "Dark charts",
          body: "## Proposed idea\nDarker.",
        },
        [userMessage("u1", "Idea")],
      ),
    ).toBe("## Proposed idea\nDarker.\n\n_Submitted via in-app feedback._");
  });
});

describe("createFeedbackTools", () => {
  it("creates the issue with the formatted body and kind labels", async () => {
    const createIssue = vi.fn().mockResolvedValue({
      number: 42,
      url: "https://github.com/Shtian/inflation-station/issues/42",
    });
    const tools = createFeedbackTools({
      repo: "Shtian/inflation-station",
      messages: [userMessage("u1", "Idea", { pathname: "/categories" })],
      createIssue,
    });

    const result = await tools.createGithubIssue.execute?.(
      {
        kind: "feature",
        title: "Bulk recategorize",
        body: "## Proposed idea\nBulk.",
      },
      { toolCallId: "call-1", messages: [] },
    );

    expect(result).toEqual({
      number: 42,
      url: "https://github.com/Shtian/inflation-station/issues/42",
    });
    expect(createIssue).toHaveBeenCalledWith({
      repo: "Shtian/inflation-station",
      title: "Bulk recategorize",
      body: "## Proposed idea\nBulk.\n\n## Context\n\n**Pages**\n- `/categories`\n\n_Submitted via in-app feedback._",
      labels: ["enhancement", "needs-triage"],
    });
  });
});

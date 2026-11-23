import { describe, expect, it, vi } from "vite-plus/test";
import {
  createFeedbackTools,
  formatIssueBody,
  resolveFeedbackAvailability,
} from "./agent";
import type { PickedElement } from "./contract";

const saveButton: PickedElement = {
  selector: '[data-testid="save-transaction"]',
  tagName: "button",
  label: "save-transaction",
  text: "Lagre",
  html: '<button data-testid="save-transaction">Lagre</button>',
};

describe("resolveFeedbackAvailability", () => {
  it("is enabled with a key, a repo and a token, trimmed", () => {
    expect(
      resolveFeedbackAvailability({
        OPENAI_API_KEY: "sk-test",
        FEEDBACK_GITHUB_REPO: " Shtian/inflation-station ",
        FEEDBACK_GITHUB_TOKEN: " github_pat_test ",
      }),
    ).toEqual({
      enabled: true,
      github: { repo: "Shtian/inflation-station", token: "github_pat_test" },
    });
  });

  it("reports key_missing before checking GitHub", () => {
    expect(resolveFeedbackAvailability({ OPENAI_API_KEY: "  " })).toEqual({
      enabled: false,
      reason: "key_missing",
    });
  });

  it("reports repo_missing when the repo is unset", () => {
    expect(
      resolveFeedbackAvailability({
        OPENAI_API_KEY: "sk-test",
        FEEDBACK_GITHUB_TOKEN: "github_pat_test",
      }),
    ).toEqual({ enabled: false, reason: "repo_missing" });
  });

  it("reports token_missing when the token is blank", () => {
    expect(
      resolveFeedbackAvailability({
        OPENAI_API_KEY: "sk-test",
        FEEDBACK_GITHUB_REPO: "Shtian/inflation-station",
        FEEDBACK_GITHUB_TOKEN: " ",
      }),
    ).toEqual({ enabled: false, reason: "token_missing" });
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
        { pathname: "/transactions", element: saveButton },
        { pathname: "/transactions", element: saveButton },
        { pathname: "/accounts" },
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
        {
          pathname: "/",
          element: { ...saveButton, text: "", html: "<pre>```</pre>" },
        },
      ],
    );

    expect(body).toContain(
      '- `[data-testid="save-transaction"]`\n\n  ````html\n  <pre>```</pre>\n  ````',
    );
  });

  it("omits the context section when no message has context", () => {
    expect(
      formatIssueBody(
        {
          kind: "feature",
          title: "Dark charts",
          body: "## Proposed idea\nDarker.",
        },
        [],
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
    const [createGithubIssue] = createFeedbackTools({
      contexts: [{ pathname: "/categories" }],
      createIssue,
    });

    const result = await createGithubIssue?.execute?.({
      kind: "feature",
      title: "Bulk recategorize",
      body: "## Proposed idea\nBulk.",
    });

    expect(result).toEqual({
      number: 42,
      url: "https://github.com/Shtian/inflation-station/issues/42",
    });
    expect(createIssue).toHaveBeenCalledWith({
      title: "Bulk recategorize",
      body: "## Proposed idea\nBulk.\n\n## Context\n\n**Pages**\n- `/categories`\n\n_Submitted via in-app feedback._",
      labels: ["enhancement", "needs-triage"],
    });
  });
});

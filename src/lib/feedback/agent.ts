import { convertToModelMessages, type ModelMessage, tool } from "ai";
import {
  type CreatedIssue,
  type FeedbackDisabledReason,
  type FeedbackUIMessage,
  type IssueDraft,
  issueDraftSchema,
  type PickedElement,
} from "./contract";

export const FEEDBACK_AGENT_MODEL = "gpt-6-luna";

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function resolveFeedbackDisabledReason(
  env: Record<string, string | undefined> = process.env,
): FeedbackDisabledReason | null {
  if (!env.OPENAI_API_KEY?.trim()) {
    return "key_missing";
  }
  return resolveFeedbackRepo(env) ? null : "repo_missing";
}

export function resolveFeedbackRepo(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const repo = env.FEEDBACK_GITHUB_REPO?.trim() ?? "";
  return REPO_PATTERN.test(repo) ? repo : null;
}

export const FEEDBACK_SYSTEM_PROMPT = `You are the feedback assistant inside Inflation Station, a personal-finance app (bank imports, transactions, categories, accounts, monthly reviews). Your only job is to turn a user's bug report or feature idea into a GitHub issue.

How to work:
- Reply in the user's language (often Norwegian). Keep replies short and friendly; the user is not a developer. Write chat replies as plain text without Markdown; they are not rendered.
- Ask at most one or two short clarifying questions, and only when something essential is missing. Then propose an issue.
- Propose an issue by calling the createGithubIssue tool. The user sees the draft and approves or rejects it in the UI.
- Never claim an issue was created unless the tool output says so. When it does, share the issue number.
- If the user rejects a draft, ask briefly what to change, then propose a revised draft.
- If the request is not feedback about this app, politely decline and invite the user to share a bug or an idea instead.

Each user message may start with context lines: "[Page: ...]" is the page the user was on, and "[Selected element: ...]" is an element they picked on that page. Use them to understand where the problem is.

Writing the issue:
- Write the title and body in English, even when the conversation is in another language.
- Title: short and specific.
- Bug body sections: "## What happened", "## Expected", "## Steps / where".
- Feature body sections: "## Problem / motivation", "## Proposed idea", "## Open questions".
- Keep it short. Never invent details the user did not give; write "Not specified" instead.
- Do not add page or element context to the body yourself; it is attached automatically.`;

function describeElementForModel(element: PickedElement): string {
  const fields = [
    element.selector,
    `<${element.tagName}>`,
    `label: ${element.label ?? "none"}`,
    `text: ${JSON.stringify(element.text)}`,
    `html: ${element.html}`,
  ];
  return `[Selected element: ${fields.join(" | ")}]`;
}

const STALE_DRAFT_REASON =
  "The user replied with more feedback instead of approving this draft.";

function withContextParts(message: FeedbackUIMessage): FeedbackUIMessage {
  if (message.role !== "user" || !message.metadata) {
    return message;
  }
  const { pathname, element } = message.metadata;
  const context = [`[Page: ${pathname}]`];
  if (element) {
    context.push(describeElementForModel(element));
  }
  return {
    ...message,
    parts: [{ type: "text", text: context.join("\n") }, ...message.parts],
  };
}

// A draft left in approval-requested means the user typed a reply instead of
// using the buttons. Sending it as denied keeps the draft in the model's
// context; an unanswered tool call would otherwise be rejected by the provider.
function withStaleDraftsDenied(message: FeedbackUIMessage): FeedbackUIMessage {
  return {
    ...message,
    parts: message.parts.map((part) =>
      part.type === "tool-createGithubIssue" &&
      part.state === "approval-requested"
        ? {
            ...part,
            state: "output-denied",
            approval: {
              id: part.approval.id,
              approved: false,
              reason: STALE_DRAFT_REASON,
            },
          }
        : part,
    ),
  };
}

export function toModelMessages(
  messages: FeedbackUIMessage[],
): Promise<ModelMessage[]> {
  const lastIndex = messages.length - 1;
  const prepared = messages.map((message, index) => {
    const withContext = withContextParts(message);
    return index < lastIndex ? withStaleDraftsDenied(withContext) : withContext;
  });
  return convertToModelMessages(prepared, { ignoreIncompleteToolCalls: true });
}

function fenceFor(content: string): string {
  const longestRun = Math.max(
    0,
    ...(content.match(/`+/g) ?? []).map((run) => run.length),
  );
  return "`".repeat(Math.max(3, longestRun + 1));
}

export function formatIssueBody(
  draft: IssueDraft,
  messages: FeedbackUIMessage[],
): string {
  const pages: string[] = [];
  const elements = new Map<string, PickedElement>();
  for (const message of messages) {
    if (message.role !== "user" || !message.metadata) {
      continue;
    }
    const { pathname, element } = message.metadata;
    if (!pages.includes(pathname)) {
      pages.push(pathname);
    }
    if (element && !elements.has(element.selector)) {
      elements.set(element.selector, element);
    }
  }

  const sections = [draft.body.trim()];
  if (pages.length > 0 || elements.size > 0) {
    const context = ["## Context"];
    if (pages.length > 0) {
      context.push("", "**Pages**", ...pages.map((page) => `- \`${page}\``));
    }
    if (elements.size > 0) {
      context.push("", "**Selected elements**");
      for (const element of elements.values()) {
        const text = element.text ? ` — ${JSON.stringify(element.text)}` : "";
        const fence = fenceFor(element.html);
        context.push(
          `- \`${element.selector}\`${text}`,
          "",
          `  ${fence}html`,
          ...element.html.split("\n").map((line) => `  ${line}`),
          `  ${fence}`,
        );
      }
    }
    sections.push(context.join("\n"));
  }
  sections.push("_Submitted via in-app feedback._");
  return sections.join("\n\n");
}

export type CreateIssueFn = (input: {
  repo: string;
  title: string;
  body: string;
  labels: string[];
}) => Promise<CreatedIssue>;

export function createFeedbackTools({
  repo,
  messages,
  createIssue,
}: {
  repo: string;
  messages: FeedbackUIMessage[];
  createIssue: CreateIssueFn;
}) {
  return {
    createGithubIssue: tool({
      description:
        "Propose a GitHub issue for the user's bug report or feature idea. The user reviews the draft and must approve it before it is created.",
      inputSchema: issueDraftSchema,
      needsApproval: true,
      execute: (draft): Promise<CreatedIssue> =>
        createIssue({
          repo,
          title: draft.title,
          body: formatIssueBody(draft, messages),
          labels: [
            draft.kind === "bug" ? "bug" : "enhancement",
            "needs-triage",
          ],
        }),
    }),
  };
}

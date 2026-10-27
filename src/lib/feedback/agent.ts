import {
  type ChatMiddleware,
  type ModelMessage,
  toolDefinition,
} from "@tanstack/ai";
import { ENV, type TypedEnvSchema } from "varlock/env";
import {
  type CreatedIssue,
  createdIssueSchema,
  draftDeclineSchema,
  type FeedbackDisabledReason,
  type FeedbackMessageMetadata,
  type IssueDraft,
  issueDraftSchema,
  type PickedElement,
  readFeedbackMetadata,
} from "./contract";
import type { FeedbackGithubTarget, IssueInput } from "./github-issue";

export const FEEDBACK_AGENT_MODEL = "gpt-6-luna";

type FeedbackEnv = Pick<
  TypedEnvSchema,
  "OPENAI_API_KEY" | "FEEDBACK_GITHUB_REPO" | "FEEDBACK_GITHUB_TOKEN"
>;

export type FeedbackAvailability =
  | { enabled: true; github: FeedbackGithubTarget }
  | { enabled: false; reason: FeedbackDisabledReason };

export function resolveFeedbackAvailability(
  env: FeedbackEnv = ENV,
): FeedbackAvailability {
  if (!env.OPENAI_API_KEY?.trim()) {
    return { enabled: false, reason: "key_missing" };
  }
  const repo = env.FEEDBACK_GITHUB_REPO?.trim();
  if (!repo) {
    return { enabled: false, reason: "repo_missing" };
  }
  const token = env.FEEDBACK_GITHUB_TOKEN?.trim();
  if (!token) {
    return { enabled: false, reason: "token_missing" };
  }
  return { enabled: true, github: { repo, token } };
}

export const FEEDBACK_SYSTEM_PROMPT = `You are the feedback assistant inside Inflation Station, a personal-finance app (bank imports, transactions, categories, accounts, monthly reviews). Your only job is to turn a user's bug report or feature idea into a GitHub issue.

How to work:
- Reply in the user's language (often Norwegian). Keep replies short and friendly; the user is not a developer.
- Ask at most one or two short clarifying questions, and only when something essential is missing. Then propose an issue.
- Propose an issue by calling the createGithubIssue tool. The user sees the draft and approves or rejects it in the UI.
- Never claim an issue was created unless the tool output says so. When it does, share the issue number.
- A declined createGithubIssue call means the user chose not to submit that draft yet. Nothing failed, so do not apologize for an error. Ask briefly what to change, then propose a revised draft.
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

function withContext(message: ModelMessage): ModelMessage {
  const metadata = readFeedbackMetadata(message);
  if (message.role !== "user" || !metadata) {
    return message;
  }
  const context = [`[Page: ${metadata.pathname}]`];
  if (metadata.element) {
    context.push(describeElementForModel(metadata.element));
  }
  const prefix = context.join("\n");
  return {
    ...message,
    content:
      typeof message.content === "string"
        ? `${prefix}\n${message.content}`
        : [{ type: "text", content: prefix }, ...(message.content ?? [])],
  };
}

const STALE_DRAFT_REASON =
  "The user replied with more feedback instead of approving this draft.";

function withStaleDraftsDeclined(messages: ModelMessage[]): ModelMessage[] {
  const answered = new Set(
    messages.flatMap((message) =>
      message.role === "tool" && message.toolCallId ? [message.toolCallId] : [],
    ),
  );
  const lastUserIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );
  return messages.flatMap((message, index) => {
    const stale =
      index < lastUserIndex
        ? (message.toolCalls ?? []).filter((call) => !answered.has(call.id))
        : [];
    return [
      message,
      ...stale.map((call): ModelMessage => ({
        role: "tool",
        toolCallId: call.id,
        name: call.function.name,
        content: STALE_DRAFT_REASON,
      })),
    ];
  });
}

export const feedbackContextMiddleware: ChatMiddleware = {
  name: "feedback-context",
  onConfig: (_ctx, config) => ({
    providerMessages: withStaleDraftsDeclined(
      (config.providerMessages ?? config.messages).map(withContext),
    ),
  }),
};

function fenceFor(content: string): string {
  const longestRun = Math.max(
    0,
    ...(content.match(/`+/g) ?? []).map((run) => run.length),
  );
  return "`".repeat(Math.max(3, longestRun + 1));
}

export function formatIssueBody(
  draft: IssueDraft,
  contexts: FeedbackMessageMetadata[],
): string {
  const pages: string[] = [];
  const elements = new Map<string, PickedElement>();
  for (const { pathname, element } of contexts) {
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

export type CreateIssueFn = (issue: IssueInput) => Promise<CreatedIssue>;

export const createGithubIssueTool = toolDefinition({
  name: "createGithubIssue",
  description:
    "Propose a GitHub issue for the user's bug report or feature idea. The user reviews the draft and must approve it before it is created.",
  inputSchema: issueDraftSchema,
  outputSchema: createdIssueSchema,
  needsApproval: true,
  approvalSchema: { reject: draftDeclineSchema },
});

export function createFeedbackTools({
  contexts,
  createIssue,
}: {
  contexts: FeedbackMessageMetadata[];
  createIssue: CreateIssueFn;
}) {
  return [
    createGithubIssueTool.server((draft) =>
      createIssue({
        title: draft.title,
        body: formatIssueBody(draft, contexts),
        labels: [draft.kind === "bug" ? "bug" : "enhancement", "needs-triage"],
      }),
    ),
  ];
}

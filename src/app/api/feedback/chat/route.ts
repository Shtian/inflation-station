import { createOpenAI } from "@ai-sdk/openai";
import { safeValidateUIMessages, stepCountIs, streamText } from "ai";
import { NextResponse } from "next/server";
import {
  createFeedbackTools,
  FEEDBACK_AGENT_MODEL,
  FEEDBACK_SYSTEM_PROMPT,
  resolveFeedbackDisabledReason,
  resolveFeedbackRepo,
  toModelMessages,
} from "@/lib/feedback/agent";
import {
  type FeedbackUIMessage,
  feedbackMessageMetadataSchema,
} from "@/lib/feedback/contract";
import {
  createGithubIssue,
  GithubIssueError,
} from "@/lib/feedback/github-issue";

function invalidMessages(message: string) {
  return NextResponse.json(
    { error: "INVALID_FEEDBACK_MESSAGES", message },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  const disabledReason = resolveFeedbackDisabledReason();
  const repo = resolveFeedbackRepo();
  if (disabledReason || !repo) {
    return NextResponse.json(
      {
        error: "FEEDBACK_UNAVAILABLE",
        reason: disabledReason ?? "repo_missing",
      },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return invalidMessages("Request body must be JSON.");
  }

  // Validation only reads the tool schemas, so the conversation is not needed yet.
  const schemaTools = createFeedbackTools({
    repo,
    messages: [],
    createIssue: createGithubIssue,
  });
  const validation = await safeValidateUIMessages<FeedbackUIMessage>({
    messages: (payload as { messages?: unknown } | null)?.messages,
    // Assistant messages carry no metadata; only user messages are stamped.
    metadataSchema: feedbackMessageMetadataSchema.optional(),
    tools: schemaTools,
  });
  if (!validation.success) {
    return invalidMessages(validation.error.message);
  }
  const messages = validation.data;

  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  });
  const tools = createFeedbackTools({
    repo,
    messages,
    createIssue: createGithubIssue,
  });
  const result = streamText({
    model: openai.chat(FEEDBACK_AGENT_MODEL),
    system: FEEDBACK_SYSTEM_PROMPT,
    messages: await toModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    maxRetries: 0,
    providerOptions: { openai: { reasoningEffort: "low" } },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    // The SDK masks every error by default; gh failures are safe and actionable.
    onError: (error) =>
      error instanceof GithubIssueError
        ? error.message
        : "The feedback assistant ran into a problem.",
  });
}

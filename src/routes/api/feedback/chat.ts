import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { safeValidateUIMessages, stepCountIs, streamText } from "ai";
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
import { setAiChatScope } from "@/lib/sentry/ai-chat";

function invalidMessages(message: string) {
  return Response.json(
    { error: "INVALID_FEEDBACK_MESSAGES", message },
    { status: 400 },
  );
}

export const Route = createFileRoute("/api/feedback/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const disabledReason = resolveFeedbackDisabledReason();
        const repo = resolveFeedbackRepo();
        if (disabledReason || !repo) {
          return Response.json(
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
          return invalidMessages("Forespørselen må være JSON.");
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

        setAiChatScope("feedback", (payload as { id?: unknown } | null)?.id);
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
          // Chat Completions rejects function tools combined with reasoning for this model.
          providerOptions: { openai: { reasoningEffort: "none" } },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          // The SDK masks every error by default; gh failures are safe and actionable.
          onError: (error) => {
            if (error instanceof GithubIssueError) {
              return error.message;
            }
            console.error("Feedback chat failed", error);
            return "Tilbakemeldingsassistenten fikk et problem.";
          },
        });
      },
    },
  },
});

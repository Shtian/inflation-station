import { trace } from "@opentelemetry/api";
import {
  chat,
  chatParamsFromRequestBody,
  EventType,
  maxIterations,
  type StreamChunk,
  toServerSentEventsResponse,
} from "@tanstack/ai";
import { createOpenaiChat } from "@tanstack/ai-openai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { createFileRoute } from "@tanstack/react-router";
import { ENV } from "varlock/env";
import {
  createFeedbackTools,
  FEEDBACK_AGENT_MODEL,
  FEEDBACK_SYSTEM_PROMPT,
  feedbackContextMiddleware,
  resolveFeedbackAvailability,
} from "@/lib/feedback/agent";
import {
  type FeedbackMessageMetadata,
  feedbackMessageMetadataSchema,
} from "@/lib/feedback/contract";
import {
  createGithubIssue,
  type IssueInput,
} from "@/lib/feedback/github-issue";
import { setAiChatScope } from "@/lib/sentry/ai-chat";

const GENERIC_ERROR = "Tilbakemeldingsassistenten fikk et problem.";

function invalidMessages(message: string) {
  return Response.json(
    { error: "INVALID_FEEDBACK_MESSAGES", message },
    { status: 400 },
  );
}

// TanStack AI sends provider errors to the client verbatim, both the ones a
// provider reports in the stream and the ones it throws.
async function* maskRunErrors(
  stream: AsyncIterable<StreamChunk>,
): AsyncIterable<StreamChunk> {
  try {
    for await (const chunk of stream) {
      if (chunk.type !== EventType.RUN_ERROR) {
        yield chunk;
        continue;
      }
      console.error("Feedback chat failed", chunk.message);
      yield {
        ...chunk,
        message: GENERIC_ERROR,
        error: { message: GENERIC_ERROR },
      };
    }
  } catch (error) {
    console.error("Feedback chat failed", error);
    throw new Error(GENERIC_ERROR);
  }
}

export const Route = createFileRoute("/api/feedback/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const availability = resolveFeedbackAvailability();
        if (!availability.enabled) {
          return Response.json(
            { error: "FEEDBACK_UNAVAILABLE", reason: availability.reason },
            { status: 503 },
          );
        }
        const createIssue = (issue: IssueInput) =>
          createGithubIssue(availability.github, issue);

        let params: Awaited<ReturnType<typeof chatParamsFromRequestBody>>;
        try {
          params = await chatParamsFromRequestBody(await request.json());
        } catch (error) {
          return invalidMessages(
            error instanceof SyntaxError
              ? "Forespørselen må være JSON."
              : String(error instanceof Error ? error.message : error),
          );
        }

        const contexts: FeedbackMessageMetadata[] = [];
        for (const message of params.messages) {
          if (message.role !== "user" || message.metadata === undefined) {
            continue;
          }
          const metadata = feedbackMessageMetadataSchema.safeParse(
            message.metadata,
          );
          if (!metadata.success) {
            return invalidMessages(metadata.error.message);
          }
          contexts.push(metadata.data);
        }

        setAiChatScope("feedback", params.threadId);
        const stream = chat({
          adapter: createOpenaiChat(
            FEEDBACK_AGENT_MODEL,
            ENV.OPENAI_API_KEY?.trim() ?? "",
            { maxRetries: 0 },
          ),
          messages: params.messages,
          threadId: params.threadId,
          runId: params.runId,
          parentRunId: params.parentRunId,
          resume: params.resume,
          systemPrompts: [FEEDBACK_SYSTEM_PROMPT],
          tools: createFeedbackTools({ contexts, createIssue }),
          reasoning: "off",
          modelOptions: { store: false },
          agentLoopStrategy: maxIterations(5),
          middleware: [
            feedbackContextMiddleware,
            otelMiddleware({ tracer: trace.getTracer("feedback-chat") }),
          ],
        });

        return toServerSentEventsResponse(maskRunErrors(stream));
      },
      ANY: async () => new Response(null, { status: 405 }),
    },
  },
});

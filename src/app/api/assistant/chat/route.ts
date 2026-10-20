import { createOpenAI } from "@ai-sdk/openai";
import {
  APICallError,
  consumeStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateId,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ASSISTANT_AGENT_MODEL,
  buildAssistantSystemPrompt,
  createAssistantTools,
  resolveAssistantDisabledReason,
} from "@/lib/assistant/agent";
import {
  type AssistantChatAvailability,
  type AssistantUIMessage,
  assistantChatOptionsSchema,
  DEFAULT_ASSISTANT_REASONING_EFFORT,
} from "@/lib/assistant/contract";
import { selectAssistantModelIds } from "@/lib/assistant/models";
import {
  assistantThreadIdSchema,
  saveAssistantThreadMessages,
} from "@/lib/assistant/threads";
import {
  acceptsChatModel,
  listChatModels,
  toSelectableChatModels,
} from "@/lib/openai/chat-models";
import { prisma } from "@/lib/prisma";
import { setAiChatScope } from "@/lib/sentry/ai-chat";

// The API key is read per request, so a key added after the build still
// enables the chat.
export const dynamic = "force-dynamic";

function invalidMessages(message: string) {
  return NextResponse.json(
    { error: "INVALID_ASSISTANT_MESSAGES", message },
    { status: 400 },
  );
}

// Which efforts a model takes varies and OpenAI's model list does not say, so
// the rejection is the only signal the client can act on.
const openAIErrorBodySchema = z.object({
  error: z.object({ param: z.string().nullish() }),
});

function rejectsReasoningEffort(error: unknown): boolean {
  if (!APICallError.isInstance(error) || !error.responseBody) {
    return false;
  }
  try {
    const body = openAIErrorBodySchema.safeParse(
      JSON.parse(error.responseBody),
    );
    return body.success && body.data.error.param === "reasoning.effort";
  } catch {
    return false;
  }
}

function invalidOptions(message: string) {
  return NextResponse.json(
    { error: "INVALID_ASSISTANT_OPTIONS", message },
    { status: 400 },
  );
}

export async function GET() {
  const disabledReason = resolveAssistantDisabledReason();
  const { availableModels } = toSelectableChatModels(
    disabledReason
      ? { source: "unavailable" }
      : await listChatModels(selectAssistantModelIds),
    {
      resolvedModelId: ASSISTANT_AGENT_MODEL,
      defaultModelId: ASSISTANT_AGENT_MODEL,
    },
  );
  return NextResponse.json({
    disabledReason,
    availableModels,
    defaultModelId: ASSISTANT_AGENT_MODEL,
  } satisfies AssistantChatAvailability);
}

export async function POST(request: Request) {
  if (resolveAssistantDisabledReason()) {
    return NextResponse.json(
      { error: "ASSISTANT_UNAVAILABLE" },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return invalidMessages("Forespørselen må være JSON.");
  }

  const body = payload as {
    id?: unknown;
    messages?: unknown;
    modelId?: unknown;
    reasoningEffort?: unknown;
  } | null;
  const threadId = assistantThreadIdSchema.safeParse(body?.id);
  if (!threadId.success) {
    return invalidMessages("Samtalen mangler en gyldig id.");
  }
  const id = threadId.data;

  const options = assistantChatOptionsSchema.partial().safeParse({
    modelId: body?.modelId,
    reasoningEffort: body?.reasoningEffort,
  });
  if (!options.success) {
    return invalidOptions("Modellen eller tenkenivået er ikke gyldig.");
  }
  const modelId = options.data.modelId ?? ASSISTANT_AGENT_MODEL;
  const reasoningEffort =
    options.data.reasoningEffort ?? DEFAULT_ASSISTANT_REASONING_EFFORT;
  // GET always offers the default, even when OpenAI's list leaves it out.
  if (
    modelId !== ASSISTANT_AGENT_MODEL &&
    !acceptsChatModel(await listChatModels(selectAssistantModelIds), modelId)
  ) {
    return invalidOptions(`Modellen ${modelId} er ikke tilgjengelig.`);
  }

  const tools = createAssistantTools({ db: prisma });
  const validation = await safeValidateUIMessages<AssistantUIMessage>({
    messages: body?.messages,
    tools,
  });
  if (!validation.success) {
    return invalidMessages(validation.error.message);
  }
  const messages = validation.data;

  // Saved before the model runs, so a reload while it answers still shows the
  // question.
  await saveAssistantThreadMessages(prisma, id, messages);

  setAiChatScope("assistant", id);
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  });
  const result = streamText({
    model: openai.responses(modelId),
    system: buildAssistantSystemPrompt({ today: new Date() }),
    messages: await convertToModelMessages(messages, {
      ignoreIncompleteToolCalls: true,
    }),
    tools,
    // Room for listCategories or listAccounts before the query that uses
    // their ids, a retry after a tool error, and the answer.
    stopWhen: stepCountIs(6),
    maxRetries: 0,
    // The SDK only knows o-series and gpt-5 as reasoning models and silently
    // drops the effort for newer ones such as gpt-6-luna.
    providerOptions: { openai: { reasoningEffort, forceReasoning: true } },
  });

  const stream = result.toUIMessageStream({
    originalMessages: messages,
    generateMessageId: generateId,
    onFinish: async ({ messages: finishedMessages }) => {
      try {
        await saveAssistantThreadMessages(prisma, id, finishedMessages);
      } catch (error) {
        console.error("Saving assistant thread failed", error);
      }
    },
    onError: (error) => {
      console.error("Assistant chat failed", error);
      return rejectsReasoningEffort(error)
        ? "UNSUPPORTED_REASONING_EFFORT"
        : "Spør fikk et problem.";
    },
  });
  // Cancelling a response body aborts the stream it reads, which would save a
  // half answer. The server drains its own branch, so a reload or closed tab
  // mid-answer still saves the whole turn.
  const [clientStream, serverStream] = stream.tee();
  void consumeStream({ stream: serverStream });

  return createUIMessageStreamResponse({ stream: clientStream });
}

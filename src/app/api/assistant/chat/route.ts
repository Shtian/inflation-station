import { createOpenAI } from "@ai-sdk/openai";
import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateId,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
} from "ai";
import { NextResponse } from "next/server";
import {
  ASSISTANT_AGENT_MODEL,
  buildAssistantSystemPrompt,
  createAssistantTools,
  resolveAssistantDisabledReason,
} from "@/lib/assistant/agent";
import type { AssistantUIMessage } from "@/lib/assistant/contract";
import {
  assistantThreadIdSchema,
  saveAssistantThreadMessages,
} from "@/lib/assistant/threads";
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

export function GET() {
  return NextResponse.json({
    disabledReason: resolveAssistantDisabledReason(),
  });
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

  const body = payload as { id?: unknown; messages?: unknown } | null;
  const threadId = assistantThreadIdSchema.safeParse(body?.id);
  if (!threadId.success) {
    return invalidMessages("Samtalen mangler en gyldig id.");
  }
  const id = threadId.data;

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
    model: openai.chat(ASSISTANT_AGENT_MODEL),
    system: buildAssistantSystemPrompt({ today: new Date() }),
    messages: await convertToModelMessages(messages, {
      ignoreIncompleteToolCalls: true,
    }),
    tools,
    // Room for listCategories or listAccounts before the query that uses
    // their ids, a retry after a tool error, and the answer.
    stopWhen: stepCountIs(6),
    maxRetries: 0,
    // Chat Completions rejects function tools combined with reasoning for this model.
    providerOptions: { openai: { reasoningEffort: "none" } },
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
      return "Spør fikk et problem.";
    },
  });
  // Cancelling a response body aborts the stream it reads, which would save a
  // half answer. The server drains its own branch, so a reload or closed tab
  // mid-answer still saves the whole turn.
  const [clientStream, serverStream] = stream.tee();
  void consumeStream({ stream: serverStream });

  return createUIMessageStreamResponse({ stream: clientStream });
}

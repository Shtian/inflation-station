import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { safeValidateUIMessages, stepCountIs, streamText } from "ai";
import { ENV } from "varlock/env";
import {
  buildOnboardingSystemPrompt,
  createOnboardingTools,
  ONBOARDING_AGENT_MODEL,
  resolveOnboardingDisabledReason,
  toModelMessages,
} from "@/lib/onboarding/agent";
import type { OnboardingUIMessage } from "@/lib/onboarding/contract";
import { loadSetupSnapshot } from "@/lib/onboarding/setup-store";
import { prisma } from "@/lib/prisma";
import { setAiChatScope } from "@/lib/sentry/ai-chat";

function invalidMessages(message: string) {
  return Response.json(
    { error: "INVALID_ONBOARDING_MESSAGES", message },
    { status: 400 },
  );
}

export const Route = createFileRoute("/api/onboarding/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (resolveOnboardingDisabledReason()) {
          return Response.json(
            { error: "ONBOARDING_UNAVAILABLE" },
            { status: 503 },
          );
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return invalidMessages("Forespørselen må være JSON.");
        }

        const tools = createOnboardingTools({ db: prisma });
        const validation = await safeValidateUIMessages<OnboardingUIMessage>({
          messages: (payload as { messages?: unknown } | null)?.messages,
          tools,
        });
        if (!validation.success) {
          return invalidMessages(validation.error.message);
        }
        const messages = validation.data;

        setAiChatScope("onboarding", (payload as { id?: unknown } | null)?.id);
        const openai = createOpenAI({
          apiKey: ENV.OPENAI_API_KEY?.trim() ?? "",
        });
        const result = streamText({
          model: openai.chat(ONBOARDING_AGENT_MODEL),
          system: buildOnboardingSystemPrompt(await loadSetupSnapshot(prisma)),
          messages: await toModelMessages(messages),
          tools,
          stopWhen: stepCountIs(5),
          maxRetries: 0,
          // Chat Completions rejects function tools combined with reasoning for this model.
          providerOptions: { openai: { reasoningEffort: "none" } },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onError: (error) => {
            console.error("Onboarding chat failed", error);
            return "Oppsettsguiden fikk et problem.";
          },
        });
      },
      ANY: async () => new Response(null, { status: 405 }),
    },
  },
});

import * as Sentry from "@sentry/nextjs";

const CHAT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const AGENT_TAG = "ai.agent";

export type AiChatAgent = "assistant" | "feedback" | "onboarding";

// Labels a chat request in Sentry before the model runs. The agent name groups
// Agent Runs and tags the request's errors; the conversation id groups turns
// in Conversations, since useChat sends the same opaque id with every turn.
export function setAiChatScope(agent: AiChatAgent, conversationId: unknown) {
  Sentry.setTag(AGENT_TAG, agent);
  if (typeof conversationId === "string" && CHAT_ID.test(conversationId)) {
    Sentry.setConversationId(conversationId);
  }
}

// The Vercel AI integration sets no gen_ai.agent.name, so this copies the
// request's agent onto its AI spans the way the SDK applies conversation ids.
export function labelAiAgentSpan(
  span: Parameters<typeof Sentry.spanToJSON>[0],
) {
  const agent = Sentry.getIsolationScope().getScopeData().tags[AGENT_TAG];
  const { name, attributes } = Sentry.spanToJSON(span);
  const op = attributes[Sentry.SEMANTIC_ATTRIBUTE_SENTRY_OP];
  if (typeof agent !== "string" || !String(op).startsWith("gen_ai.")) {
    return;
  }
  span.setAttribute("gen_ai.agent.name", agent);
  if (name === "invoke_agent") {
    Sentry.updateSpanName(span, `invoke_agent ${agent}`);
  }
}

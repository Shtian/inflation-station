import { type ChatStatus, isToolUIPart } from "ai";
import type { AssistantUIMessage } from "./contract";

export type AssistantChatStatus = "Henter tall…" | "Tenker…";

export function getAssistantChatStatus(
  status: ChatStatus,
  messages: AssistantUIMessage[],
): AssistantChatStatus | null {
  if (status !== "submitted" && status !== "streaming") {
    return null;
  }

  const latest = messages.at(-1);
  if (latest?.role !== "assistant") {
    return "Tenker…";
  }

  const lastToolIndex = latest.parts.findLastIndex(isToolUIPart);
  const answering = latest.parts
    .slice(lastToolIndex + 1)
    .some((part) => part.type === "text" && part.text);
  if (answering) {
    return null;
  }

  const fetching = latest.parts.some(
    (part) =>
      isToolUIPart(part) &&
      (part.state === "input-streaming" || part.state === "input-available"),
  );
  return fetching ? "Henter tall…" : "Tenker…";
}

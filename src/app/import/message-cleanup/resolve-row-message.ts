import type { MessageCleanupUnavailableReason } from "@/lib/import/message-cleanup/reasons";

export const MESSAGE_SOURCE_ORIGINAL = "original" as const;
export const MESSAGE_SOURCE_CLEANED = "cleaned" as const;

export type MessageSource =
  | typeof MESSAGE_SOURCE_ORIGINAL
  | typeof MESSAGE_SOURCE_CLEANED;

export type MessageSuggestion =
  | { status: "pending" }
  | { status: "cleaned"; text: string }
  | { status: "none" }
  | { status: "unavailable"; reason: MessageCleanupUnavailableReason };

export type ResolvedRowMessage = {
  source: MessageSource;
  display: string;
  originalMessage: string;
  hasCleanedAlternative: boolean;
  cleanedText: string | null;
  isPending: boolean;
  isUnavailable: boolean;
};

export function resolveRowMessage(params: {
  originalMessage: string;
  suggestion: MessageSuggestion;
  override?: MessageSource;
}): ResolvedRowMessage {
  const cleanedText =
    params.suggestion.status === "cleaned" ? params.suggestion.text : null;
  const hasCleanedAlternative = cleanedText !== null;

  const source: MessageSource =
    params.override ??
    (hasCleanedAlternative ? MESSAGE_SOURCE_CLEANED : MESSAGE_SOURCE_ORIGINAL);

  const display =
    source === MESSAGE_SOURCE_CLEANED && cleanedText
      ? cleanedText
      : params.originalMessage;

  return {
    source,
    display,
    originalMessage: params.originalMessage,
    hasCleanedAlternative,
    cleanedText,
    isPending: params.suggestion.status === "pending",
    isUnavailable: params.suggestion.status === "unavailable",
  };
}

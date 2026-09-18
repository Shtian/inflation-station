import type { CleanupChunkResponse } from "@/lib/import/message-cleanup/wire";
import type { MessageSuggestion } from "./resolve-row-message";

export type SuggestionsByRowId = Record<string, MessageSuggestion>;

export function applyChunkResult(
  current: SuggestionsByRowId,
  rowIds: string[],
  result: CleanupChunkResponse,
): SuggestionsByRowId {
  const next = { ...current };

  if (result.status === "unavailable") {
    for (const rowId of rowIds) {
      next[rowId] = { status: "unavailable", reason: result.reason };
    }
    return next;
  }

  const cleanedByRowId = new Map(
    result.suggestions.map((suggestion) => [
      suggestion.rowId,
      suggestion.cleanedMessage,
    ]),
  );

  for (const rowId of rowIds) {
    const cleanedMessage = cleanedByRowId.get(rowId);
    next[rowId] = cleanedMessage
      ? { status: "cleaned", text: cleanedMessage }
      : { status: "none" };
  }

  return next;
}

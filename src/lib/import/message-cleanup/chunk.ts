import { createOpenAI } from "@ai-sdk/openai";
import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { generateObject } from "ai";
import { buildProviderErrorDetail } from "../../openai/provider-errors";
import {
  DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
  DEFAULT_MESSAGE_CLEANUP_SYSTEM_PROMPT,
} from "../message-cleanup-settings";
import type { ChunkFailureReason } from "./reasons";
import {
  type CleanupChunkProviderPayload,
  cleanupChunkProviderSchema,
} from "./wire";

export const DEFAULT_CHUNK_TIMEOUT_MS = 20_000;

export type ChunkInputRow = {
  rowNumber: number;
  message: string;
};

export type ChunkSuggestion = {
  rowNumber: number;
  cleanedMessage: string;
};

export type ChunkResult =
  | { status: "ok"; suggestions: ChunkSuggestion[] }
  | { status: "unavailable"; reason: ChunkFailureReason };

export function reconcileSuggestions(
  payload: CleanupChunkProviderPayload,
  rowNumbers: Set<number>,
): ChunkSuggestion[] {
  const seen = new Set<number>();

  return payload.suggestions.flatMap((suggestion) => {
    if (
      !rowNumbers.has(suggestion.rowNumber) ||
      seen.has(suggestion.rowNumber)
    ) {
      return [];
    }

    const cleanedMessage = suggestion.cleanedMessage.trim();
    if (!cleanedMessage) {
      return [];
    }

    seen.add(suggestion.rowNumber);
    return [{ rowNumber: suggestion.rowNumber, cleanedMessage }];
  });
}

export async function runCleanupChunk(params: {
  apiKey: string;
  rows: ChunkInputRow[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  model?: OpenAIChatModelId;
  systemPrompt?: string;
}): Promise<ChunkResult> {
  const timeoutMs = Math.max(1, params.timeoutMs ?? DEFAULT_CHUNK_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const rowNumbers = new Set(params.rows.map((row) => row.rowNumber));

  try {
    const openai = createOpenAI({
      apiKey: params.apiKey,
      fetch: params.fetchImpl ?? fetch,
    });

    const result = await generateObject({
      model: openai.chat(params.model ?? DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL),
      schema: cleanupChunkProviderSchema,
      system: params.systemPrompt ?? DEFAULT_MESSAGE_CLEANUP_SYSTEM_PROMPT,
      prompt: JSON.stringify({
        instructions: [
          "Clean and normalize noisy transaction message text.",
          "Do not invent details not present in the original message.",
          "Keep suggestions concise and user-readable.",
          "Return only rows you can improve.",
        ],
        rows: params.rows,
      }),
      abortSignal: controller.signal,
      providerOptions: {
        openai: {
          strictJsonSchema: true,
        },
      },
    });

    return {
      status: "ok",
      suggestions: reconcileSuggestions(result.object, rowNumbers),
    };
  } catch (error) {
    console.error("Import message cleanup chunk request failed", {
      timeoutMs,
      detail: buildProviderErrorDetail(error),
    });

    return { status: "unavailable", reason: "provider_error" };
  } finally {
    clearTimeout(timeoutId);
  }
}

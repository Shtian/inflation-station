import { createOpenAI } from "@ai-sdk/openai";
import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { generateText } from "ai";
import {
  buildProviderErrorDetail,
  isAbortError,
} from "../openai/provider-errors";

export type MessageCleanupUnavailableReason =
  | "disabled"
  | "key_missing"
  | "timeout"
  | "provider_error";

const DEFAULT_PROVIDER_TIMEOUT_MS = 8_000;
const DEFAULT_OPENAI_MODEL: OpenAIChatModelId = "gpt-5-mini";

export type MessageCleanupInputRow = {
  rowNumber: number;
  message: string;
};

export type MessageCleanupSuggestion = {
  rowNumber: number;
  cleanedMessage: string;
};

export type MessageCleanupResult = {
  suggestions: MessageCleanupSuggestion[];
  unavailableReason: MessageCleanupUnavailableReason | null;
};

type MessageCleanupPayload = {
  suggestions?: Array<{
    rowNumber?: number;
    cleanedMessage?: string;
  }>;
};

function normalizeInputRows(rows: MessageCleanupInputRow[]) {
  return rows
    .map((row) => ({
      rowNumber: row.rowNumber,
      message: row.message.trim(),
    }))
    .filter((row) => row.message.length > 0);
}

function parseSuggestions(
  payload: string,
  rowNumbers: Set<number>,
): MessageCleanupSuggestion[] {
  const parsed = JSON.parse(payload) as MessageCleanupPayload;
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
    : [];
  const seen = new Set<number>();

  return suggestions.flatMap((suggestion) => {
    if (
      typeof suggestion.rowNumber !== "number" ||
      !Number.isInteger(suggestion.rowNumber) ||
      !rowNumbers.has(suggestion.rowNumber) ||
      seen.has(suggestion.rowNumber)
    ) {
      return [];
    }

    const cleanedMessage =
      typeof suggestion.cleanedMessage === "string"
        ? suggestion.cleanedMessage.trim()
        : "";

    if (!cleanedMessage) {
      return [];
    }

    seen.add(suggestion.rowNumber);
    return [{ rowNumber: suggestion.rowNumber, cleanedMessage }];
  });
}

export async function buildOpenAiMessageCleanup(params: {
  enabled?: boolean;
  apiKey: string | null | undefined;
  rows: MessageCleanupInputRow[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  model?: string;
}): Promise<MessageCleanupResult> {
  if (params.enabled === false) {
    return {
      suggestions: [],
      unavailableReason: "disabled",
    };
  }

  const apiKey = params.apiKey?.trim();
  if (!apiKey) {
    return {
      suggestions: [],
      unavailableReason: "key_missing",
    };
  }

  const rows = normalizeInputRows(params.rows);
  if (rows.length === 0) {
    return {
      suggestions: [],
      unavailableReason: null,
    };
  }

  const fetchImpl = params.fetchImpl ?? fetch;
  const timeoutMs = Math.max(
    1,
    params.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
  );
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const rowNumbers = new Set(rows.map((row) => row.rowNumber));
  const userPrompt = JSON.stringify(
    {
      instructions: [
        "Clean and normalize noisy transaction message text.",
        "Do not invent details not present in the original message.",
        "Keep suggestions concise and user-readable.",
        "Return only rows you can improve.",
        "Return strict JSON with top-level suggestions only.",
      ],
      rows,
      outputFormat: {
        suggestions: [
          {
            rowNumber: 1,
            cleanedMessage: "normalized message",
          },
        ],
      },
    },
    null,
    2,
  );

  try {
    const openai = createOpenAI({
      apiKey,
      fetch: fetchImpl,
    });

    const result = await generateText({
      model: openai.chat(params.model ?? DEFAULT_OPENAI_MODEL),
      temperature: 0,
      maxRetries: 0,
      system:
        "You clean transaction messages. Return strict JSON with top-level suggestions only.",
      prompt: userPrompt,
      abortSignal: controller.signal,
    });

    if (!result.text) {
      return {
        suggestions: [],
        unavailableReason: "provider_error",
      };
    }

    return {
      suggestions: parseSuggestions(result.text, rowNumbers),
      unavailableReason: null,
    };
  } catch (error) {
    if (!isAbortError(error)) {
      console.error("Import message cleanup provider request failed", {
        model: params.model ?? DEFAULT_OPENAI_MODEL,
        timeoutMs,
        detail: buildProviderErrorDetail(error),
      });
    }

    return {
      suggestions: [],
      unavailableReason: isAbortError(error) ? "timeout" : "provider_error",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

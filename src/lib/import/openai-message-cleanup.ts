export type MessageCleanupUnavailableReason =
  | "disabled"
  | "key_missing"
  | "timeout"
  | "provider_error";

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

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
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

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}

export async function buildOpenAiMessageCleanup(params: {
  enabled?: boolean;
  apiKey: string | null | undefined;
  rows: MessageCleanupInputRow[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
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
  const timeoutMs = Math.max(1, params.timeoutMs ?? 8_000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You clean transaction messages. Return strict JSON with top-level suggestions only.",
            },
            {
              role: "user",
              content: JSON.stringify(
                {
                  instructions: [
                    "Clean and normalize noisy transaction message text.",
                    "Do not invent details not present in the original message.",
                    "Keep suggestions concise and user-readable.",
                    "Return only rows you can improve.",
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
              ),
            },
          ],
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return {
        suggestions: [],
        unavailableReason: "provider_error",
      };
    }

    const payload = (await response.json()) as ChatCompletionsResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return {
        suggestions: [],
        unavailableReason: "provider_error",
      };
    }

    return {
      suggestions: parseSuggestions(
        content,
        new Set(rows.map((row) => row.rowNumber)),
      ),
      unavailableReason: null,
    };
  } catch (error) {
    return {
      suggestions: [],
      unavailableReason: isAbortError(error) ? "timeout" : "provider_error",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

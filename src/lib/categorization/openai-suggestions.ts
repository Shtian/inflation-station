import {
  type CategoryKind,
  type PaymentType,
  SuggestionSource,
} from "@prisma/client";

export type OpenAiSuggestionTransaction = {
  id: string;
  normalizedMerchant: string;
  paymentType: PaymentType;
};

export type OpenAiSuggestionCategory = {
  id: string;
  name: string;
  kind: CategoryKind;
};

export type OpenAiCategorizationSuggestion = {
  transactionId: string;
  suggestedCategoryId: string;
  source: "OPENAI";
  confidence: number;
  reasoning: string;
};

type OpenAiSuggestionPayload = {
  suggestions: Array<{
    transactionId: string;
    categoryId: string;
    confidence?: number;
    reasoning?: string;
  }>;
};

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function parseSuggestions(
  payload: string,
  categoryIds: Set<string>,
  transactionIds: Set<string>,
): OpenAiCategorizationSuggestion[] {
  const parsed = JSON.parse(payload) as OpenAiSuggestionPayload;
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
    : [];

  return suggestions.flatMap((suggestion) => {
    if (
      !transactionIds.has(suggestion.transactionId) ||
      !categoryIds.has(suggestion.categoryId)
    ) {
      return [];
    }

    const confidence =
      typeof suggestion.confidence === "number"
        ? Math.max(0, Math.min(1, suggestion.confidence))
        : 0.6;
    const reasoning =
      typeof suggestion.reasoning === "string" && suggestion.reasoning.trim()
        ? suggestion.reasoning.trim()
        : "Suggested by OpenAI from merchant and payment metadata.";

    return [
      {
        transactionId: suggestion.transactionId,
        suggestedCategoryId: suggestion.categoryId,
        source: SuggestionSource.OPENAI,
        confidence,
        reasoning,
      },
    ];
  });
}

export async function buildOpenAiSuggestions(params: {
  apiKey: string | null | undefined;
  categories: OpenAiSuggestionCategory[];
  transactions: OpenAiSuggestionTransaction[];
  fetchImpl?: typeof fetch;
}): Promise<OpenAiCategorizationSuggestion[]> {
  const apiKey = params.apiKey?.trim();
  if (!apiKey) {
    return [];
  }

  if (params.transactions.length === 0 || params.categories.length === 0) {
    return [];
  }

  const transactionIds = new Set(params.transactions.map((item) => item.id));
  const categoryIds = new Set(params.categories.map((item) => item.id));
  const fetchImpl = params.fetchImpl ?? fetch;

  const systemPrompt =
    "You categorize financial transactions. Return strict JSON with a top-level suggestions array only.";
  const userPrompt = JSON.stringify(
    {
      instructions: [
        "For each transaction, suggest at most one category.",
        "Use only provided category IDs.",
        "Do not include transactions you cannot classify confidently.",
        "confidence must be between 0 and 1.",
      ],
      categories: params.categories,
      transactions: params.transactions,
      outputFormat: {
        suggestions: [
          {
            transactionId: "string",
            categoryId: "string",
            confidence: 0.75,
            reasoning: "short explanation",
          },
        ],
      },
    },
    null,
    2,
  );

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
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      },
    );

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as ChatCompletionsResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      return [];
    }

    return parseSuggestions(content, categoryIds, transactionIds);
  } catch {
    return [];
  }
}

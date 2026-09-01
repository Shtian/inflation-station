import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";

type ChatModelTier = "cheap" | "balanced" | "premium";

type ChatModelMetadata = {
  label: string;
  description: string;
  tier: ChatModelTier;
};

export type ChatModelEntry = {
  id: OpenAIChatModelId;
  label: string;
  description: string;
  tier: ChatModelTier;
};

const DEFAULT_CHAT_MODEL_ID = "gpt-5.4" as const satisfies OpenAIChatModelId;

const CHAT_MODEL_METADATA_BY_ID = {
  "gpt-4.1-mini": {
    label: "GPT-4.1 Mini",
    description: "Fast and low-cost for lightweight month summaries.",
    tier: "cheap",
  },
  "gpt-4o-mini": {
    label: "GPT-4o Mini",
    description: "Balanced speed and quality for routine monthly reviews.",
    tier: "cheap",
  },
  "gpt-5-mini": {
    label: "GPT-5 Mini",
    description: "Good quality with controlled cost for regular use.",
    tier: "balanced",
  },
  "gpt-5.2": {
    label: "GPT-5.2",
    description: "Solid quality/cost tradeoff for monthly analysis.",
    tier: "balanced",
  },
  "gpt-5.2-pro": {
    label: "GPT-5.2 Pro",
    description: "High quality for deeper, more nuanced spending insights.",
    tier: "premium",
  },
  "gpt-5.4-nano": {
    label: "GPT-5.4 Nano",
    description:
      "Lowest cost, fastest response for simple message cleanup tasks.",
    tier: "cheap",
  },
  "gpt-5.4-mini": {
    label: "GPT-5.4 Mini",
    description:
      "Fast and affordable, ideal for routine message cleanup and lightweight tasks.",
    tier: "balanced",
  },
  [DEFAULT_CHAT_MODEL_ID]: {
    label: "GPT-5.4",
    description: "Best default quality/cost tradeoff for monthly analysis.",
    tier: "balanced",
  },
  "gpt-5.4-pro": {
    label: "GPT-5.4 Pro",
    description:
      "Highest quality for in-depth spending insights and complex analysis.",
    tier: "premium",
  },
} as const satisfies Partial<Record<OpenAIChatModelId, ChatModelMetadata>>;

function buildChatModelRegistry(
  models: typeof CHAT_MODEL_METADATA_BY_ID,
): readonly ChatModelEntry[] {
  return (Object.keys(models) as Array<keyof typeof models & OpenAIChatModelId>)
    .map((id) => ({
      id,
      ...models[id],
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export const CHAT_MODELS = buildChatModelRegistry(CHAT_MODEL_METADATA_BY_ID);

export const DEFAULT_CHAT_MODEL: OpenAIChatModelId = DEFAULT_CHAT_MODEL_ID;

const CHAT_MODEL_BY_ID = new Map<OpenAIChatModelId, ChatModelEntry>(
  CHAT_MODELS.map((model) => [model.id, model]),
);

const DEFAULT_CHAT_MODEL_ENTRY = (() => {
  const defaultModel = CHAT_MODEL_BY_ID.get(DEFAULT_CHAT_MODEL);
  if (defaultModel) {
    return defaultModel;
  }

  throw new Error("DEFAULT_CHAT_MODEL_MISSING_FROM_REGISTRY");
})();

export function getModelById(id: string): ChatModelEntry {
  const model = CHAT_MODEL_BY_ID.get(id as OpenAIChatModelId);
  return model ?? DEFAULT_CHAT_MODEL_ENTRY;
}

export function getModelsByTier(
  tier: ChatModelTier,
): readonly ChatModelEntry[] {
  return CHAT_MODELS.filter((model) => model.tier === tier);
}

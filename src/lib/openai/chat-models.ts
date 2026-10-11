import { z } from "zod";

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
const MODEL_LIST_TTL_MS = 60 * 60 * 1000;
const MODEL_LIST_TIMEOUT_MS = 5_000;

const CHAT_MODEL_FAMILY = /^(gpt-\d|o\d)/;
const SNAPSHOT_SUFFIX = /-(\d{4}-\d{2}-\d{2}|\d{4})$/;
const EXCLUDED_ID_TOKENS = [
  "audio",
  "realtime",
  "tts",
  "transcribe",
  "image",
  "search",
  "codex",
  "instruct",
  "live",
  "chat-latest",
  "moderation",
] as const;

const openAIModelsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      created: z.number(),
      shutdown_date: z.string().nullish(),
    }),
  ),
});

export type OpenAIModel = z.infer<
  typeof openAIModelsResponseSchema
>["data"][number];

export type ChatModelList =
  | { source: "openai"; ids: string[] }
  | { source: "unavailable" };

export type SelectableChatModels = {
  availableModels: string[];
  availableModelsSource: ChatModelList["source"];
};

export function selectChatModelIds(
  models: readonly OpenAIModel[],
  today: Date,
): string[] {
  const todayIsoDate = today.toISOString().slice(0, 10);

  return models
    .filter(
      (model) =>
        CHAT_MODEL_FAMILY.test(model.id) &&
        !EXCLUDED_ID_TOKENS.some((token) => model.id.includes(token)) &&
        !SNAPSHOT_SUFFIX.test(model.id) &&
        (!model.shutdown_date || model.shutdown_date > todayIsoDate),
    )
    .sort(
      (left, right) =>
        right.created - left.created || left.id.localeCompare(right.id),
    )
    .map((model) => model.id);
}

let cachedList: { ids: string[]; expiresAt: number } | null = null;

export async function listChatModels(): Promise<ChatModelList> {
  if (cachedList && cachedList.expiresAt > Date.now()) {
    return { source: "openai", ids: cachedList.ids };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { source: "unavailable" };
  }

  try {
    const response = await fetch(OPENAI_MODELS_URL, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { source: "unavailable" };
    }

    const parsed = openAIModelsResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return { source: "unavailable" };
    }

    const ids = selectChatModelIds(parsed.data.data, new Date());
    cachedList = { ids, expiresAt: Date.now() + MODEL_LIST_TTL_MS };
    return { source: "openai", ids };
  } catch {
    return { source: "unavailable" };
  }
}

export function acceptsChatModel(list: ChatModelList, modelId: string) {
  return list.source === "unavailable" || list.ids.includes(modelId);
}

export function toSelectableChatModels(
  list: ChatModelList,
  models: { resolvedModelId: string; defaultModelId: string },
): SelectableChatModels {
  if (list.source === "unavailable") {
    return {
      availableModels: [
        ...new Set([models.resolvedModelId, models.defaultModelId]),
      ],
      availableModelsSource: "unavailable",
    };
  }

  return {
    availableModels: list.ids.includes(models.resolvedModelId)
      ? list.ids
      : [models.resolvedModelId, ...list.ids],
    availableModelsSource: "openai",
  };
}

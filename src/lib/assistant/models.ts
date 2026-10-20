import { type OpenAIModel, selectChatModelIds } from "@/lib/openai/chat-models";

export const ASSISTANT_MODEL_MAX_AGE_DAYS = 365;

const SECONDS_PER_DAY = 24 * 60 * 60;

export function selectAssistantModelIds(
  models: readonly OpenAIModel[],
  today: Date,
): string[] {
  const oldestCreated =
    Math.floor(today.getTime() / 1000) -
    ASSISTANT_MODEL_MAX_AGE_DAYS * SECONDS_PER_DAY;

  return selectChatModelIds(
    models.filter(
      (model) =>
        !model.shutdown_date &&
        model.created >= oldestCreated &&
        !model.id.includes("-pro"),
    ),
    today,
  );
}

import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { z } from "zod";
import { chatModelEntrySchema } from "./chat-model-registry";

export const promptSettingsResponseSchema = z.object({
  promptText: z.string(),
  resolvedPrompt: z.string(),
  usesDefaultPrompt: z.boolean(),
  modelId: z.string().nullable(),
  resolvedModelId: z.custom<OpenAIChatModelId>(
    (value) => typeof value === "string",
  ),
  usesDefaultModel: z.boolean(),
  availableModels: z.array(chatModelEntrySchema),
});

export type PromptSettingsResponse = z.infer<
  typeof promptSettingsResponseSchema
>;

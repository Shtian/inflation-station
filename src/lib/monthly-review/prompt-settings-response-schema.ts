import { z } from "zod";
import {
  chatModelEntrySchema,
  openAIChatModelIdSchema,
} from "./chat-model-registry";

export const promptSettingsResponseSchema = z.object({
  promptText: z.string(),
  resolvedPrompt: z.string(),
  usesDefaultPrompt: z.boolean(),
  modelId: z.string().nullable(),
  resolvedModelId: openAIChatModelIdSchema,
  usesDefaultModel: z.boolean(),
  availableModels: z.array(chatModelEntrySchema),
});

export type PromptSettingsResponse = z.infer<
  typeof promptSettingsResponseSchema
>;

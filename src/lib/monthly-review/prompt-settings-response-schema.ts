import { z } from "zod";

export const promptSettingsResponseSchema = z.object({
  promptText: z.string(),
  resolvedPrompt: z.string(),
  usesDefaultPrompt: z.boolean(),
  modelId: z.string().nullable(),
  resolvedModelId: z.string(),
  usesDefaultModel: z.boolean(),
  availableModels: z.array(z.string()),
  availableModelsSource: z.enum(["openai", "unavailable"]),
});

export type PromptSettingsResponse = z.infer<
  typeof promptSettingsResponseSchema
>;

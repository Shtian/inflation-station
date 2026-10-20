import type { InferUITools, UIMessage } from "ai";
import { z } from "zod";
import {
  REASONING_EFFORTS,
  type ReasoningEffort,
} from "@/lib/monthly-review/reasoning-effort-registry";
import type { OnboardingDisabledReason } from "@/lib/onboarding/contract";
import { UNCATEGORIZED_VALUE } from "@/lib/transactions/category-filter";
import type { createAssistantTools } from "./agent";
import { SEARCH_LIMIT_MAX } from "./search";

export const ASSISTANT_CHAT_ENDPOINT = "/api/assistant/chat";

export const DEFAULT_ASSISTANT_REASONING_EFFORT: ReasoningEffort = "none";

export const assistantChatOptionsSchema = z.object({
  modelId: z.string().trim().min(1),
  reasoningEffort: z.enum(
    REASONING_EFFORTS.map((effort) => effort.id) as [
      ReasoningEffort,
      ...ReasoningEffort[],
    ],
  ),
});

export type AssistantChatOptions = z.infer<typeof assistantChatOptionsSchema>;

export function readStoredAssistantChatOptions(
  stored: string | null,
  models: { availableModels: readonly string[]; defaultModelId: string },
): AssistantChatOptions {
  const fallback: AssistantChatOptions = {
    modelId: models.defaultModelId,
    reasoningEffort: DEFAULT_ASSISTANT_REASONING_EFFORT,
  };
  if (stored === null) {
    return fallback;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    return fallback;
  }
  const parsed = assistantChatOptionsSchema.safeParse(raw);
  if (!parsed.success) {
    return fallback;
  }

  return {
    modelId: models.availableModels.includes(parsed.data.modelId)
      ? parsed.data.modelId
      : models.defaultModelId,
    reasoningEffort: parsed.data.reasoningEffort,
  };
}

const isoDate = z
  .string()
  .describe("Local calendar day as YYYY-MM-DD, inclusive.");

export const summarizeSpendingInputSchema = z.object({
  from: isoDate,
  to: isoDate,
  groupBy: z.enum(["category", "merchant", "month", "account"]),
  categoryIds: z
    .array(z.string())
    .optional()
    .describe(
      `Category ids from listCategories. Include "${UNCATEGORIZED_VALUE}" to match transactions with no category.`,
    ),
  accountIds: z.array(z.string()).optional(),
  merchantQuery: z.string().optional(),
});

export const searchTransactionsInputSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  categoryId: z
    .string()
    .optional()
    .describe(
      `A category id from listCategories, or "${UNCATEGORIZED_VALUE}" for transactions with no category.`,
    ),
  accountId: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).optional(),
});

export const getMonthInReviewInputSchema = z.object({
  month: z.string().describe("Calendar month as YYYY-MM."),
});

export const emptyInputSchema = z.object({});

export type AssistantUITools = InferUITools<
  ReturnType<typeof createAssistantTools>
>;

export type AssistantUIMessage = UIMessage<never, never, AssistantUITools>;

export type AssistantDisabledReason = OnboardingDisabledReason;

export type AssistantChatAvailability = {
  disabledReason: AssistantDisabledReason | null;
  availableModels: string[];
  defaultModelId: string;
};

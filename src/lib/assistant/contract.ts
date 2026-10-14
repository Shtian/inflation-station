import type { InferUITools, UIMessage } from "ai";
import { z } from "zod";
import type { OnboardingDisabledReason } from "@/lib/onboarding/contract";
import type { createAssistantTools } from "./agent";
import { SEARCH_LIMIT_MAX } from "./search";

export const ASSISTANT_CHAT_ENDPOINT = "/api/assistant/chat";

const isoDate = z
  .string()
  .describe("Local calendar day as YYYY-MM-DD, inclusive.");

export const summarizeSpendingInputSchema = z.object({
  from: isoDate,
  to: isoDate,
  groupBy: z.enum(["category", "merchant", "month", "account"]),
  categoryIds: z.array(z.string()).optional(),
  accountIds: z.array(z.string()).optional(),
  merchantQuery: z.string().optional(),
});

export const searchTransactionsInputSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  categoryId: z.string().optional(),
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

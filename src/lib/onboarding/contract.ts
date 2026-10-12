import type { InferUITools, UIMessage } from "ai";
import { z } from "zod";
import type { createOnboardingTools } from "./agent";

export const ONBOARDING_CHAT_ENDPOINT = "/api/onboarding/chat";

export const CLASSIFIER_HINT_MAX_LENGTH = 200;

export const addAccountsInputSchema = z.object({
  accounts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        institution: z.string().trim().max(80).optional(),
      }),
    )
    .min(1)
    .max(10),
});

export const addCategoriesInputSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        kind: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
        classifierHint: z
          .string()
          .trim()
          .max(CLASSIFIER_HINT_MAX_LENGTH)
          .optional(),
      }),
    )
    .min(1)
    .max(30),
});

export type OnboardingUITools = InferUITools<
  ReturnType<typeof createOnboardingTools>
>;

export type OnboardingUIMessage = UIMessage<never, never, OnboardingUITools>;

export type OnboardingDisabledReason = "key_missing";

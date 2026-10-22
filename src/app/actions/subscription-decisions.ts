import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  executeServerMutation,
  type MutationActionResult,
  mutationValidationError,
} from "@/lib/server-actions/mutation-result";
import {
  clearSubscriptionDecision,
  setSubscriptionDecision,
  subscriptionDecisionStatusSchema,
  subscriptionMerchantSchema,
} from "@/lib/subscriptions/decisions";
import type { SubscriptionDecisionStatus } from "@/lib/subscriptions/model";

const setDecisionInputSchema = z.object({
  normalizedMerchant: subscriptionMerchantSchema,
  status: subscriptionDecisionStatusSchema,
});

const clearDecisionInputSchema = z.object({
  normalizedMerchant: subscriptionMerchantSchema,
});

type SetSubscriptionDecisionErrorCode =
  | "INVALID_SUBSCRIPTION_DECISION_PAYLOAD"
  | "SUBSCRIPTION_DECISION_SAVE_FAILED";

type ClearSubscriptionDecisionErrorCode =
  | "INVALID_SUBSCRIPTION_DECISION_PAYLOAD"
  | "SUBSCRIPTION_DECISION_CLEAR_FAILED";

const INVALID_PAYLOAD_MESSAGE = "Ugyldig brukersted.";

export async function setSubscriptionDecisionAction(
  input: unknown,
): Promise<
  MutationActionResult<
    { normalizedMerchant: string; status: SubscriptionDecisionStatus },
    SetSubscriptionDecisionErrorCode
  >
> {
  const parsedInput = setDecisionInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return mutationValidationError(
      "INVALID_SUBSCRIPTION_DECISION_PAYLOAD",
      INVALID_PAYLOAD_MESSAGE,
      parsedInput.error,
    );
  }

  const { normalizedMerchant, status } = parsedInput.data;

  return executeServerMutation({
    execute: async () => {
      await setSubscriptionDecision(prisma, normalizedMerchant, status);
      return { normalizedMerchant, status };
    },
    fallbackError: {
      code: "SUBSCRIPTION_DECISION_SAVE_FAILED",
      message: "Kunne ikke lagre valget. Prøv igjen.",
    },
  });
}

export async function clearSubscriptionDecisionAction(
  input: unknown,
): Promise<
  MutationActionResult<
    { normalizedMerchant: string },
    ClearSubscriptionDecisionErrorCode
  >
> {
  const parsedInput = clearDecisionInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return mutationValidationError(
      "INVALID_SUBSCRIPTION_DECISION_PAYLOAD",
      INVALID_PAYLOAD_MESSAGE,
      parsedInput.error,
    );
  }

  const { normalizedMerchant } = parsedInput.data;

  return executeServerMutation({
    execute: async () => {
      await clearSubscriptionDecision(prisma, normalizedMerchant);
      return { normalizedMerchant };
    },
    fallbackError: {
      code: "SUBSCRIPTION_DECISION_CLEAR_FAILED",
      message: "Kunne ikke gjenopprette forslaget. Prøv igjen.",
    },
  });
}

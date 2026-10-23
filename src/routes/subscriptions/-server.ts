import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import {
  clearSubscriptionDecisionAction,
  setSubscriptionDecisionAction,
} from "@/app/actions/subscription-decisions";
import { prisma } from "@/lib/prisma";
import { loadSubscriptionReview } from "@/lib/subscriptions/load";

export const getSubscriptionReview = createServerFn({ method: "GET" }).handler(
  () => loadSubscriptionReview(prisma, format(new Date(), "yyyy-MM-dd")),
);

// Validation stays in the shared mutation, which owns the error contract; see
// `trips/-server.ts` for why output is not strict.
const passThrough = (input: unknown) => input;

export const setSubscriptionDecisionFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => setSubscriptionDecisionAction(data));

export const clearSubscriptionDecisionFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => clearSubscriptionDecisionAction(data));

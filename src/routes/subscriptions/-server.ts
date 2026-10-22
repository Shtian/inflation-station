import { createServerFn } from "@tanstack/react-start";
import {
  clearSubscriptionDecisionAction,
  setSubscriptionDecisionAction,
} from "@/app/actions/subscription-decisions";

// Validation stays in the shared mutation so the error contract matches the
// Next action; see `trips/-server.ts` for why output is not strict.
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

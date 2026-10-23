import { createServerFn } from "@tanstack/react-start";
import { resolveOnboardingDisabledReason } from "@/lib/onboarding/agent";

export const getOnboardingPage = createServerFn({ method: "GET" }).handler(
  () => ({ chatEnabled: resolveOnboardingDisabledReason() === null }),
);

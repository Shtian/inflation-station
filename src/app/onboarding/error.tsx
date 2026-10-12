"use client";

import { RouteErrorState } from "@/components/route-error-state";

type OnboardingErrorProps = {
  error: Error;
  reset: () => void;
};

export default function OnboardingRouteError({
  error,
  reset,
}: OnboardingErrorProps) {
  return (
    <RouteErrorState
      title="Setup guide failed to load"
      message={
        error.message ||
        "An unexpected error occurred while loading the setup guide."
      }
      onRetry={reset}
    />
  );
}

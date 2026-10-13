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
      title="Oppsettsguiden kunne ikke lastes inn"
      message={
        error.message ||
        "Det oppstod en uventet feil under innlasting av oppsettsguiden."
      }
      onRetry={reset}
    />
  );
}

"use client";

import { RouteErrorState } from "@/components/route-error-state";

type SubscriptionsRouteErrorProps = {
  error: Error;
  reset: () => void;
};

export default function SubscriptionsRouteError({
  error,
  reset,
}: SubscriptionsRouteErrorProps) {
  return (
    <RouteErrorState
      error={error}
      title="Kunne ikke laste inn faste trekk"
      message={
        error.message ||
        "Det oppstod en uventet feil under lasting av faste trekk."
      }
      onRetry={reset}
    />
  );
}

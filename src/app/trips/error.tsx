"use client";

import { RouteErrorState } from "@/components/route-error-state";

type TripsRouteErrorProps = {
  error: Error;
  reset: () => void;
};

export default function TripsRouteError({
  error,
  reset,
}: TripsRouteErrorProps) {
  return (
    <RouteErrorState
      error={error}
      title="Kunne ikke laste inn turer"
      message={
        error.message || "Det oppstod en uventet feil under lasting av turer."
      }
      onRetry={reset}
    />
  );
}

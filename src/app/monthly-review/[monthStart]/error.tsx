"use client";

import { RouteErrorState } from "@/components/route-error-state";

type MonthInReviewRouteErrorProps = {
  error: Error;
  reset: () => void;
};

export default function MonthInReviewRouteError({
  error,
  reset,
}: MonthInReviewRouteErrorProps) {
  return (
    <RouteErrorState
      error={error}
      title="Kunne ikke laste inn måneden som gikk"
      message={
        error.message ||
        "Det oppstod en uventet feil under lasting av måneden som gikk."
      }
      onRetry={reset}
    />
  );
}

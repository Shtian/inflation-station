"use client";

import { RouteErrorState } from "@/components/route-error-state";

type MonthlyReviewRouteErrorProps = {
  error: Error;
  reset: () => void;
};

export default function MonthlyReviewRouteError({
  error,
  reset,
}: MonthlyReviewRouteErrorProps) {
  return (
    <RouteErrorState
      title="Kunne ikke laste inn tidslinjen for månedsoppsummering"
      message={
        error.message ||
        "Det oppstod en uventet feil under lasting av tidslinjen for månedsoppsummering."
      }
      onRetry={reset}
    />
  );
}

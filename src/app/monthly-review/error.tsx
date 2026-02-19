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
      title="Monthly review timeline failed to load"
      message={
        error.message ||
        "An unexpected error occurred while loading monthly review timeline data."
      }
      onRetry={reset}
    />
  );
}

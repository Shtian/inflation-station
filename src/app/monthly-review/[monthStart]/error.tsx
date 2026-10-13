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
      title="Month in review failed to load"
      message={
        error.message ||
        "An unexpected error occurred while loading this month in review."
      }
      onRetry={reset}
    />
  );
}

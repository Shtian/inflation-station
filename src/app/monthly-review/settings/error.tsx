"use client";

import { RouteErrorState } from "@/components/route-error-state";

type MonthlyReviewSettingsRouteErrorProps = {
  error: Error;
  reset: () => void;
};

export default function MonthlyReviewSettingsRouteError({
  error,
  reset,
}: MonthlyReviewSettingsRouteErrorProps) {
  return (
    <RouteErrorState
      title="Monthly review settings failed to load"
      message={
        error.message ||
        "An unexpected error occurred while loading monthly review settings."
      }
      onRetry={reset}
    />
  );
}

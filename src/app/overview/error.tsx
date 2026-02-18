"use client";

import { RouteErrorState } from "@/components/route-error-state";

type OverviewErrorProps = {
  error: Error;
  reset: () => void;
};

export default function OverviewRouteError({
  error,
  reset,
}: OverviewErrorProps) {
  return (
    <RouteErrorState
      title="Overview failed to load"
      message={
        error.message ||
        "An unexpected error occurred while loading overview data."
      }
      onRetry={reset}
    />
  );
}

"use client";

import { RouteErrorState } from "@/components/route-error-state";

type ImportErrorProps = {
  error: Error;
  reset: () => void;
};

export default function ImportRouteError({ error, reset }: ImportErrorProps) {
  return (
    <RouteErrorState
      title="Import workspace failed to load"
      message={
        error.message ||
        "An unexpected error occurred while loading the import flow."
      }
      onRetry={reset}
    />
  );
}

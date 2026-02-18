"use client";

import { RouteErrorState } from "@/components/route-error-state";

type AccountsErrorProps = {
  error: Error;
  reset: () => void;
};

export default function AccountsRouteError({
  error,
  reset,
}: AccountsErrorProps) {
  return (
    <RouteErrorState
      title="Accounts failed to load"
      message={
        error.message || "An unexpected error occurred while loading accounts."
      }
      onRetry={reset}
    />
  );
}

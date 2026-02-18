"use client";

import { RouteErrorState } from "@/components/route-error-state";

type TransactionsErrorProps = {
  error: Error;
  reset: () => void;
};

export default function TransactionsRouteError({
  error,
  reset,
}: TransactionsErrorProps) {
  return (
    <RouteErrorState
      title="Transactions failed to load"
      message={
        error.message ||
        "An unexpected error occurred while loading transactions."
      }
      onRetry={reset}
    />
  );
}

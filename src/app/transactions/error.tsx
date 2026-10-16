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
      error={error}
      title="Transaksjonene kunne ikke lastes inn"
      message={
        error.message ||
        "Det oppstod en uventet feil under innlasting av transaksjoner."
      }
      onRetry={reset}
    />
  );
}

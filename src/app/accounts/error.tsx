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
      title="Kunne ikke laste inn kontoer"
      message={
        error.message ||
        "Det oppstod en uventet feil under innlasting av kontoer."
      }
      onRetry={reset}
    />
  );
}

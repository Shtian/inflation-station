"use client";

import { RouteErrorState } from "@/components/route-error-state";

type SettingsRouteErrorProps = {
  error: Error;
  reset: () => void;
};

export default function SettingsRouteError({
  error,
  reset,
}: SettingsRouteErrorProps) {
  return (
    <RouteErrorState
      error={error}
      title="Kunne ikke laste inn innstillingene"
      message={
        error.message ||
        "Det oppstod en uventet feil under lasting av innstillingene."
      }
      onRetry={reset}
    />
  );
}

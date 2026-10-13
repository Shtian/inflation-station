"use client";

import { RouteErrorState } from "@/components/route-error-state";

type MessageCleanupSettingsRouteErrorProps = {
  error: Error;
  reset: () => void;
};

export default function MessageCleanupSettingsRouteError({
  error,
  reset,
}: MessageCleanupSettingsRouteErrorProps) {
  return (
    <RouteErrorState
      title="Kunne ikke laste inn innstillingene for meldingsrydding"
      message={
        error.message ||
        "Det oppstod en uventet feil under lasting av innstillingene for meldingsrydding."
      }
      onRetry={reset}
    />
  );
}

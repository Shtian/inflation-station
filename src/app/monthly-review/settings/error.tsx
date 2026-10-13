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
      title="Kunne ikke laste inn innstillingene for månedsoppsummering"
      message={
        error.message ||
        "Det oppstod en uventet feil under lasting av innstillingene for månedsoppsummering."
      }
      onRetry={reset}
    />
  );
}

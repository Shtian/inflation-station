"use client";

import { RouteErrorState } from "@/components/route-error-state";

type ProviderMappingsErrorProps = {
  error: Error;
  reset: () => void;
};

export default function ProviderMappingsRouteError({
  error,
  reset,
}: ProviderMappingsErrorProps) {
  return (
    <RouteErrorState
      title="Provider mappings failed to load"
      message={
        error.message ||
        "An unexpected error occurred while loading import provider mappings."
      }
      onRetry={reset}
    />
  );
}

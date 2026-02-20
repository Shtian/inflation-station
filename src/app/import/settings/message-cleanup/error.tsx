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
      title="Message cleanup settings failed to load"
      message={
        error.message ||
        "An unexpected error occurred while loading message cleanup settings."
      }
      onRetry={reset}
    />
  );
}

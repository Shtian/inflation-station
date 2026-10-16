"use client";

import { RouteErrorState } from "@/components/route-error-state";

type AssistantErrorProps = {
  error: Error;
  reset: () => void;
};

export default function AssistantRouteError({
  error,
  reset,
}: AssistantErrorProps) {
  return (
    <RouteErrorState
      error={error}
      title="Chatten kunne ikke lastes inn"
      message={
        error.message ||
        "Det oppstod en uventet feil under innlasting av chatten."
      }
      onRetry={reset}
    />
  );
}

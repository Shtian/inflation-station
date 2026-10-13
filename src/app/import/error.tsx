"use client";

import { RouteErrorState } from "@/components/route-error-state";

type ImportErrorProps = {
  error: Error;
  reset: () => void;
};

export default function ImportRouteError({ error, reset }: ImportErrorProps) {
  return (
    <RouteErrorState
      title="Importen kunne ikke lastes inn"
      message={
        error.message ||
        "Det oppstod en uventet feil under innlasting av importen."
      }
      onRetry={reset}
    />
  );
}

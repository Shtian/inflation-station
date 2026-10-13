"use client";

import { RouteErrorState } from "@/components/route-error-state";

type CategoriesErrorProps = {
  error: Error;
  reset: () => void;
};

export default function CategoriesRouteError({
  error,
  reset,
}: CategoriesErrorProps) {
  return (
    <RouteErrorState
      title="Kunne ikke laste inn kategorier"
      message={
        error.message ||
        "Det oppstod en uventet feil under innlasting av kategorier."
      }
      onRetry={reset}
    />
  );
}

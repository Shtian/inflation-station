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
      title="Categories failed to load"
      message={
        error.message ||
        "An unexpected error occurred while loading categories."
      }
      onRetry={reset}
    />
  );
}

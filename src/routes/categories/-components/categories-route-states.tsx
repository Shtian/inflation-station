import type { ErrorComponentProps } from "@tanstack/react-router";
import { RouteLoadingState } from "@/components/route-loading-state";
import { RouteError } from "@/routes/-shell/route-states";

export function CategoriesPending() {
  return <RouteLoadingState label="Laster inn kategorier…" />;
}

export function CategoriesError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Kunne ikke laste inn kategorier"
      fallbackMessage="Det oppstod en uventet feil under innlasting av kategorier."
    />
  );
}

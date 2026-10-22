import type { ErrorComponentProps } from "@tanstack/react-router";
import { RouteLoadingState } from "@/components/route-loading-state";
import { RouteError } from "@/routes/-shell/route-states";

export function TripsPending() {
  return <RouteLoadingState label="Laster inn turer…" />;
}

export function TripsError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Kunne ikke laste inn turer"
      fallbackMessage="Det oppstod en uventet feil under lasting av turer."
    />
  );
}

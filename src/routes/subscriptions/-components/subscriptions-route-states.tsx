import type { ErrorComponentProps } from "@tanstack/react-router";
import { RouteLoadingState } from "@/components/route-loading-state";
import { RouteError } from "@/routes/-shell/route-states";

export function SubscriptionsPending() {
  return <RouteLoadingState label="Laster inn faste trekk…" />;
}

export function SubscriptionsError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Kunne ikke laste inn faste trekk"
      fallbackMessage="Det oppstod en uventet feil under lasting av faste trekk."
    />
  );
}

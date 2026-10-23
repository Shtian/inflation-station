import type { ErrorComponentProps } from "@tanstack/react-router";
import { RouteLoadingState } from "@/components/route-loading-state";
import { RouteError } from "@/routes/-shell/route-states";

export function MonthlyReviewPending() {
  return (
    <RouteLoadingState label="Laster inn tidslinjen for månedsoppsummering…" />
  );
}

export function MonthlyReviewError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Kunne ikke laste inn tidslinjen for månedsoppsummering"
      fallbackMessage="Det oppstod en uventet feil under lasting av tidslinjen for månedsoppsummering."
    />
  );
}

export function MonthInReviewError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Kunne ikke laste inn måneden som gikk"
      fallbackMessage="Det oppstod en uventet feil under lasting av måneden som gikk."
    />
  );
}

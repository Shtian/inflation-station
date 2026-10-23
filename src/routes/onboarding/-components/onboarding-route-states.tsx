import type { ErrorComponentProps } from "@tanstack/react-router";
import { RouteLoadingState } from "@/components/route-loading-state";
import { RouteError } from "@/routes/-shell/route-states";

export function OnboardingPending() {
  return <RouteLoadingState label="Laster inn oppsettsguiden..." />;
}

export function OnboardingError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Oppsettsguiden kunne ikke lastes inn"
      fallbackMessage="Det oppstod en uventet feil under innlasting av oppsettsguiden."
    />
  );
}

import type { ErrorComponentProps } from "@tanstack/react-router";
import { RouteLoadingState } from "@/components/route-loading-state";
import { RouteError } from "@/routes/-shell/route-states";

export function SettingsPending() {
  return <RouteLoadingState label="Laster inn innstillingene…" />;
}

export function SettingsError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Kunne ikke laste inn innstillingene"
      fallbackMessage="Det oppstod en uventet feil under lasting av innstillingene."
    />
  );
}

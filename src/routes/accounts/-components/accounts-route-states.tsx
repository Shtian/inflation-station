import type { ErrorComponentProps } from "@tanstack/react-router";
import { RouteLoadingState } from "@/components/route-loading-state";
import { RouteError } from "@/routes/-shell/route-states";

export function AccountsPending() {
  return <RouteLoadingState label="Laster inn kontoer…" />;
}

export function AccountsError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Kunne ikke laste inn kontoer"
      fallbackMessage="Det oppstod en uventet feil under innlasting av kontoer."
    />
  );
}

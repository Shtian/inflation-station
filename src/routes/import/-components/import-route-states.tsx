import type { ErrorComponentProps } from "@tanstack/react-router";
import { RouteLoadingState } from "@/components/route-loading-state";
import { RouteError } from "@/routes/-shell/route-states";

export function ImportPending() {
  return <RouteLoadingState label="Laster inn import…" />;
}

export function ImportError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Importen kunne ikke lastes inn"
      fallbackMessage="Det oppstod en uventet feil under innlasting av importen."
    />
  );
}

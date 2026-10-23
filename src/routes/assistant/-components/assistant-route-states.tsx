import type { ErrorComponentProps } from "@tanstack/react-router";
import { RouteLoadingState } from "@/components/route-loading-state";
import { RouteError } from "@/routes/-shell/route-states";

export function AssistantPending() {
  return <RouteLoadingState label="Laster inn chatten..." />;
}

export function AssistantError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Chatten kunne ikke lastes inn"
      fallbackMessage="Det oppstod en uventet feil under innlasting av chatten."
    />
  );
}

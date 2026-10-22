import type { ErrorComponentProps } from "@tanstack/react-router";
import { RouteLoadingState } from "@/components/route-loading-state";
import { RouteError } from "@/routes/-shell/route-states";

export function TransactionsPending() {
  return <RouteLoadingState label="Laster inn transaksjoner…" />;
}

export function TransactionsError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Transaksjonene kunne ikke lastes inn"
      fallbackMessage="Det oppstod en uventet feil under innlasting av transaksjoner."
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AccountsRouteRoot } from "@/app/accounts/accounts-route-root";
import {
  AccountsError,
  AccountsPending,
} from "./-components/accounts-route-states";

export const Route = createFileRoute("/accounts/")({
  head: () => ({ meta: [{ title: "Kontoer · Inflation Station" }] }),
  pendingComponent: AccountsPending,
  errorComponent: AccountsError,
  component: AccountsRouteRoot,
});

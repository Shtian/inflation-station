import { createFileRoute } from "@tanstack/react-router";
import { TransactionsManager } from "@/app/transactions/transactions-manager";
import type { TransactionSorting } from "@/app/transactions/transactions-manager.types";
import {
  formatSortingParam,
  parseTransactionsTableUrlState,
  type TransactionsTableUrlState,
} from "@/app/transactions/transactions-table-url-state";
import {
  TransactionsError,
  TransactionsPending,
} from "./-components/transactions-route-states";
import { getTripOptions } from "./-server";

/**
 * Raw values arrive as strings, or numbers when they look numeric. Navigation
 * also re-validates the typed state it is handed, so `sorting` can be the
 * model's object; `parseTransactionsTableUrlState` still decides its validity.
 */
function validateSearch(search: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      params.set(key, String(value));
    } else if (key === "sorting" && typeof value === "object" && value) {
      params.set(key, formatSortingParam(value as TransactionSorting));
    }
  }
  return parseTransactionsTableUrlState(params);
}

/**
 * The router JSON-encodes object values, which would write
 * `sorting={"field":…}` where the table's links and specs expect
 * `sorting=amountNok:asc`. The cast holds only until the router stringifies the
 * result; reads always go back through `validateSearch`.
 */
function encodeSorting(search: TransactionsTableUrlState) {
  if (!search.sorting) {
    return search;
  }
  return {
    ...search,
    sorting: formatSortingParam(search.sorting),
  } as unknown as TransactionsTableUrlState;
}

export const Route = createFileRoute("/transactions/")({
  validateSearch,
  search: { middlewares: [({ search, next }) => encodeSorting(next(search))] },
  loader: () => getTripOptions(),
  head: () => ({ meta: [{ title: "Transaksjoner · Inflation Station" }] }),
  pendingComponent: TransactionsPending,
  errorComponent: TransactionsError,
  component: TransactionsPage,
});

function TransactionsPage() {
  const trips = Route.useLoaderData();

  return (
    <main className="mx-auto w-full full-width:max-w-none max-w-6xl px-5 py-8 md:px-10">
      <TransactionsManager trips={trips} />
    </main>
  );
}

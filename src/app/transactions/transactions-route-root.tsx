import { TransactionsManager } from "./transactions-manager";

export function TransactionsRouteRoot() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <TransactionsManager />
    </main>
  );
}

import { TransactionsManager } from "./transactions-manager";

export default function TransactionsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 has-[[data-table-width=full]]:max-w-none md:px-10">
      <TransactionsManager />
    </main>
  );
}

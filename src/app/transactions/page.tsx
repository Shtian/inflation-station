import { prisma } from "@/lib/prisma";
import { listTripOptions } from "@/lib/trips/load";
import { TransactionsManager } from "./transactions-manager";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const trips = await listTripOptions(prisma);

  return (
    <main className="mx-auto w-full full-width:max-w-none max-w-6xl px-5 py-8 md:px-10">
      <TransactionsManager trips={trips} />
    </main>
  );
}

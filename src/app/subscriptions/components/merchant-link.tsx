import { Link } from "@tanstack/react-router";
import type { RecurringCandidate } from "@/lib/subscriptions/model";

export function MerchantLink({
  candidate,
}: {
  candidate: Pick<RecurringCandidate, "displayName" | "normalizedMerchant">;
}) {
  return (
    <Link
      to="/transactions"
      search={{ globalQuery: candidate.normalizedMerchant }}
      title={`Se transaksjoner fra ${candidate.displayName}`}
      className="font-medium text-foreground underline-offset-4 hover:underline"
    >
      {candidate.displayName}
    </Link>
  );
}

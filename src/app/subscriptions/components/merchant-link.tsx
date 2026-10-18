import Link from "next/link";
import type { RecurringCandidate } from "@/lib/subscriptions/model";
import { merchantTransactionsHref } from "../format";

export function MerchantLink({
  candidate,
}: {
  candidate: Pick<RecurringCandidate, "displayName" | "normalizedMerchant">;
}) {
  return (
    <Link
      href={merchantTransactionsHref(candidate.normalizedMerchant)}
      title={`Se transaksjoner fra ${candidate.displayName}`}
      className="font-medium text-foreground underline-offset-4 hover:underline"
    >
      {candidate.displayName}
    </Link>
  );
}

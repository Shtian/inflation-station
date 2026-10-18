import type { SubscriptionReview } from "@/lib/subscriptions/review";
import { describeExcludedFromTotals, formatAmount } from "../format";

export function SubscriptionTotals({
  totals,
}: {
  totals: SubscriptionReview["totals"];
}) {
  const excluded = describeExcludedFromTotals(totals.excluded);

  return (
    <div className="space-y-2">
      <dl className="flex flex-wrap gap-x-10 gap-y-4">
        <div className="space-y-1">
          <dt className="text-muted-foreground text-sm">Per måned</dt>
          <dd className="font-semibold text-2xl text-foreground tabular-nums tracking-tight">
            {formatAmount(totals.monthlyNok)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground text-sm">Per år</dt>
          <dd className="font-semibold text-2xl text-foreground tabular-nums tracking-tight">
            {formatAmount(totals.yearlyNok)}
          </dd>
        </div>
      </dl>
      {excluded ? (
        <p className="text-muted-foreground text-sm">{excluded}</p>
      ) : null}
    </div>
  );
}

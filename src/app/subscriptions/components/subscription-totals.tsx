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
          <dt className="text-sm text-muted-foreground">Per måned</dt>
          <dd className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {formatAmount(totals.monthlyNok)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-sm text-muted-foreground">Per år</dt>
          <dd className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {formatAmount(totals.yearlyNok)}
          </dd>
        </div>
      </dl>
      {excluded ? (
        <p className="text-sm text-muted-foreground">{excluded}</p>
      ) : null}
    </div>
  );
}

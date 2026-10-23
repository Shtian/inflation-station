import { TriangleAlert } from "lucide-react";
import type { SubscriptionAlert } from "@/lib/subscriptions/model";
import type { TrackedSubscription } from "@/lib/subscriptions/review";
import { describeAlert, describeYearlyImpact } from "../format";
import { DecisionButton, type DecisionIntent } from "./decision-button";
import { MerchantLink } from "./merchant-link";

const ALERT_ACTIONS: Record<SubscriptionAlert["kind"], DecisionIntent | null> =
  {
    PRICE_CHANGE: null,
    MISSED_CHARGE: "END",
    CHARGED_AFTER_END: "RECONFIRM",
  };

export function AttentionStrip({
  subscriptions,
}: {
  subscriptions: TrackedSubscription[];
}) {
  const entries = subscriptions.flatMap(({ candidate, alerts }) =>
    alerts.map((alert) => ({ candidate, alert })),
  );
  if (entries.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="subscriptions-attention"
      className="rounded-md border border-border px-4 py-3"
    >
      <h2
        id="subscriptions-attention"
        className="flex items-center gap-2 text-sm font-medium text-warning"
      >
        <TriangleAlert aria-hidden className="size-4" />
        Trenger oppmerksomhet
      </h2>
      <ul className="mt-1 divide-y divide-border">
        {entries.map(({ candidate, alert }) => {
          const impact = describeYearlyImpact(alert, candidate);
          const action = ALERT_ACTIONS[alert.kind];
          return (
            <li
              key={`${candidate.key}|${alert.kind}`}
              className="flex min-h-11 items-center justify-between gap-4 py-1.5 text-sm"
            >
              <p>
                <MerchantLink candidate={candidate} />
                <span className="text-foreground">
                  : {describeAlert(alert, candidate)}
                </span>
                {impact ? (
                  <span className="text-warning tabular-nums">, {impact}</span>
                ) : null}
              </p>
              {action ? (
                <DecisionButton
                  intent={action}
                  normalizedMerchant={candidate.normalizedMerchant}
                  displayName={candidate.displayName}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

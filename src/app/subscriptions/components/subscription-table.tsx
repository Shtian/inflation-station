import { TriangleAlert } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecurringCandidate } from "@/lib/subscriptions/model";
import {
  hasMissedCharge,
  type TrackedSubscription,
} from "@/lib/subscriptions/review";
import {
  CADENCE_LABELS,
  describeAlert,
  formatAmount,
  formatDay,
} from "../format";
import { DecisionButton, type DecisionIntent } from "./decision-button";
import { MerchantLink } from "./merchant-link";

export type SubscriptionTableRow = TrackedSubscription & {
  actions: DecisionIntent[];
};

/** Shared by every section so the columns line up down the page. */
const COLUMNS = [
  { header: "Brukersted", className: "" },
  { header: "Hyppighet", className: "w-28" },
  { header: "Beløp", className: "w-28 text-right" },
  { header: "Per år", className: "w-28 text-right" },
  { header: "Siste trekk", className: "w-32" },
  { header: "Neste trekk", className: "w-32" },
  { header: "Handlinger", className: "w-48" },
] as const;

export function untracked(candidate: RecurringCandidate): TrackedSubscription {
  return { candidate, alerts: [] };
}

export function SubscriptionTable({
  rows,
  ended = false,
}: {
  rows: SubscriptionTableRow[];
  /** Ended subscriptions have no next charge to show. */
  ended?: boolean;
}) {
  return (
    <div className="rounded-md border border-border">
      <Table className="min-w-3xl table-fixed">
        <colgroup>
          {COLUMNS.map(({ header, className }) => (
            <col key={header} className={className} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow>
            {COLUMNS.map(({ header, className }) => (
              <TableHead key={header} className={className}>
                {header === "Handlinger" ? (
                  <span className="sr-only">{header}</span>
                ) : (
                  header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ candidate, alerts, actions }) => (
            <TableRow key={candidate.key}>
              <TableCell>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">
                    <MerchantLink candidate={candidate} />
                  </span>
                  {alerts.length > 0 ? (
                    <TriangleAlert
                      aria-hidden
                      className="size-3.5 shrink-0 text-warning"
                    >
                      <title>
                        {alerts
                          .map((alert) => describeAlert(alert, candidate))
                          .join("; ")}
                      </title>
                    </TriangleAlert>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{CADENCE_LABELS[candidate.cadence]}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(candidate.currentAmountNok)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(candidate.annualizedNok)}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatDay(candidate.lastChargeDate)}
              </TableCell>
              <TableCell className="tabular-nums">
                {ended ? (
                  <span className="text-muted-foreground">–</span>
                ) : hasMissedCharge(alerts) ? (
                  <span
                    className="text-warning"
                    title="Ventet, men ikke trukket"
                  >
                    {formatDay(candidate.nextExpectedDate)}
                  </span>
                ) : (
                  formatDay(candidate.nextExpectedDate)
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {actions.map((intent) => (
                    <DecisionButton
                      key={intent}
                      intent={intent}
                      normalizedMerchant={candidate.normalizedMerchant}
                      displayName={candidate.displayName}
                    />
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

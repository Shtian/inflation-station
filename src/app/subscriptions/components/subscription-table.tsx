import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
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

type Column = {
  header: string;
  /** Hidden visually; the column's contents speak for themselves. */
  srOnlyHeader?: boolean;
  width: string;
  cell: string;
  render: (row: SubscriptionTableRow, ended: boolean) => ReactNode;
};

/** Shared by every section so the columns line up down the page. */
const COLUMNS: Column[] = [
  {
    header: "Brukersted",
    width: "",
    cell: "",
    render: ({ candidate, alerts }) => (
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">
          <MerchantLink candidate={candidate} />
        </span>
        {alerts.length > 0 ? (
          <TriangleAlert aria-hidden className="size-3.5 shrink-0 text-warning">
            <title>
              {alerts
                .map((alert) => describeAlert(alert, candidate))
                .join("; ")}
            </title>
          </TriangleAlert>
        ) : null}
      </div>
    ),
  },
  {
    header: "Hyppighet",
    width: "w-28",
    cell: "",
    render: ({ candidate }) => CADENCE_LABELS[candidate.cadence],
  },
  {
    header: "Beløp",
    width: "w-28",
    cell: "text-right tabular-nums",
    render: ({ candidate }) => formatAmount(candidate.currentAmountNok),
  },
  {
    header: "Per år",
    width: "w-28",
    cell: "text-right tabular-nums",
    render: ({ candidate }) => formatAmount(candidate.annualizedNok),
  },
  {
    header: "Siste trekk",
    width: "w-36",
    cell: "pl-8 tabular-nums",
    render: ({ candidate }) => formatDay(candidate.lastChargeDate),
  },
  {
    header: "Neste trekk",
    width: "w-32",
    cell: "tabular-nums",
    render: ({ candidate, alerts }, ended) =>
      ended ? (
        <span className="text-muted-foreground">–</span>
      ) : hasMissedCharge(alerts) ? (
        <span className="text-warning" title="Ventet, men ikke trukket">
          {formatDay(candidate.nextExpectedDate)}
        </span>
      ) : (
        formatDay(candidate.nextExpectedDate)
      ),
  },
  {
    header: "Handlinger",
    srOnlyHeader: true,
    width: "w-48",
    cell: "",
    render: ({ candidate, actions }) => (
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
    ),
  },
];

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
          {COLUMNS.map(({ header, width }) => (
            <col key={header} className={width} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow>
            {COLUMNS.map(({ header, srOnlyHeader, cell }) => (
              <TableHead key={header} className={cell}>
                {srOnlyHeader ? (
                  <span className="sr-only">{header}</span>
                ) : (
                  header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.candidate.key}>
              {COLUMNS.map(({ header, cell, render }) => (
                <TableCell key={header} className={cell}>
                  {render(row, ended)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

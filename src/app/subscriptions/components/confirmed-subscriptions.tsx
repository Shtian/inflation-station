import { CalendarX, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SubscriptionAlert } from "@/lib/subscriptions/model";
import type { ConfirmedSubscription } from "@/lib/subscriptions/review";
import {
  CADENCE_LABELS,
  describeAlert,
  formatAmount,
  formatDay,
} from "../format";
import { DecisionButton } from "./decision-button";
import { MerchantLink } from "./merchant-link";

const ALERT_STYLES: Record<
  SubscriptionAlert["kind"],
  { variant: "secondary" | "destructive"; Icon: typeof TrendingUp }
> = {
  PRICE_CHANGE: { variant: "secondary", Icon: TrendingUp },
  MISSED_CHARGE: { variant: "destructive", Icon: CalendarX },
};

export function ConfirmedSubscriptions({
  subscriptions,
}: {
  subscriptions: ConfirmedSubscription[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Brukersted</TableHead>
            <TableHead>Hyppighet</TableHead>
            <TableHead className="text-right">Beløp</TableHead>
            <TableHead className="text-right">Per år</TableHead>
            <TableHead>Siste trekk</TableHead>
            <TableHead>Neste trekk</TableHead>
            <TableHead className="sr-only">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map(({ candidate, alerts }) => (
            <TableRow key={candidate.key}>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <MerchantLink candidate={candidate} />
                  {alerts.map((alert) => {
                    const { variant, Icon } = ALERT_STYLES[alert.kind];
                    return (
                      <Badge key={alert.kind} variant={variant}>
                        <Icon aria-hidden />
                        {describeAlert(alert)}
                      </Badge>
                    );
                  })}
                </div>
              </TableCell>
              <TableCell>{CADENCE_LABELS[candidate.cadence]}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(candidate.currentAmountNok)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(candidate.annualizedNok)}
              </TableCell>
              <TableCell>{formatDay(candidate.lastChargeDate)}</TableCell>
              <TableCell>{formatDay(candidate.nextExpectedDate)}</TableCell>
              <TableCell className="text-right">
                <DecisionButton
                  intent="UNCONFIRM"
                  normalizedMerchant={candidate.normalizedMerchant}
                  displayName={candidate.displayName}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

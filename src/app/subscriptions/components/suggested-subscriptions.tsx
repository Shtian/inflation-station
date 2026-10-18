import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecurringCandidate } from "@/lib/subscriptions/model";
import { CADENCE_LABELS, formatAmount, formatDay } from "../format";
import { DecisionButton } from "./decision-button";
import { MerchantLink } from "./merchant-link";

export function SuggestedSubscriptions({
  candidates,
}: {
  candidates: RecurringCandidate[];
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
            <TableHead className="text-right">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.key}>
              <TableCell>
                <MerchantLink candidate={candidate} />
              </TableCell>
              <TableCell>{CADENCE_LABELS[candidate.cadence]}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(candidate.currentAmountNok)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(candidate.annualizedNok)}
              </TableCell>
              <TableCell>{formatDay(candidate.lastChargeDate)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <DecisionButton
                    intent="CONFIRM"
                    normalizedMerchant={candidate.normalizedMerchant}
                    displayName={candidate.displayName}
                  />
                  <DecisionButton
                    intent="DISMISS"
                    normalizedMerchant={candidate.normalizedMerchant}
                    displayName={candidate.displayName}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { RecurringCandidate } from "@/lib/subscriptions/model";
import { CADENCE_LABELS, formatAmount } from "../format";
import { DecisionButton } from "./decision-button";

export function DismissedSubscriptions({
  candidates,
}: {
  candidates: RecurringCandidate[];
}) {
  return (
    <Collapsible className="space-y-2">
      <CollapsibleTrigger className="group flex items-center gap-1 rounded-md font-medium text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ChevronRight
          aria-hidden
          className="size-4 transition-transform group-data-panel-open:rotate-90"
        />
        Avviste ({candidates.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y divide-border">
          {candidates.map((candidate) => (
            <li
              key={candidate.key}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium text-foreground">
                  {candidate.displayName}
                </span>{" "}
                <span className="text-muted-foreground">
                  {CADENCE_LABELS[candidate.cadence]},{" "}
                  {formatAmount(candidate.currentAmountNok)}
                </span>
              </span>
              <DecisionButton
                intent="RESTORE"
                normalizedMerchant={candidate.normalizedMerchant}
                displayName={candidate.displayName}
              />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

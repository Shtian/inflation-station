"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setTripMembershipAction } from "@/app/actions/trips";
import { CategoryBadge } from "@/components/category-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UNCATEGORIZED_CATEGORY_NAME } from "@/lib/category-color";
import {
  MAX_TRIP_MEMBERSHIP_IDS,
  membershipChangeFor,
  type TripCandidate,
  tripCostNok,
} from "@/lib/trips/summary";
import {
  describeMembershipChange,
  describePendingChange,
  describeSelection,
  formatDay,
  TRIP_SELECT_UP_TO_LABEL,
  TRIP_SELECTION_LIMIT_MESSAGE,
} from "../format";
import { TransactionAmount } from "./trip-amount";

type TripChecklistProps = {
  tripId: string;
  candidates: TripCandidate[];
  /** Accessible name of the table, so the in-range list and search hits are told apart. */
  label: string;
  submitLabel: string;
};

const FAILED_MESSAGE = "Kunne ikke oppdatere turen. Prøv igjen.";

export function TripChecklist({
  tripId,
  candidates,
  label,
  submitLabel,
}: TripChecklistProps) {
  const [checked, setChecked] = useState(
    () =>
      new Set(
        candidates
          .filter((candidate) => candidate.defaultChecked)
          .slice(0, MAX_TRIP_MEMBERSHIP_IDS)
          .map((candidate) => candidate.id),
      ),
  );
  const [saving, startSaving] = useTransition();
  const atLimit = checked.size >= MAX_TRIP_MEMBERSHIP_IDS;
  const change = membershipChangeFor(tripId, candidates, checked);
  const unchanged = change.add.length + change.remove.length === 0;
  const checkedCandidates = candidates.filter((candidate) =>
    checked.has(candidate.id),
  );
  const pendingChange = describePendingChange({
    add: change.add.length,
    remove: change.remove.length,
  });

  function toggle(id: string, nextChecked: boolean) {
    setChecked((current) => {
      const next = new Set(current);
      if (nextChecked) {
        if (current.size >= MAX_TRIP_MEMBERSHIP_IDS) return current;
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  const oneOff = candidates.filter((candidate) => !candidate.recurring);
  const recurring = candidates.filter((candidate) => candidate.recurring);

  function renderRow(candidate: TripCandidate) {
    const otherTrip =
      candidate.trip && candidate.trip.id !== tripId ? candidate.trip : null;
    return (
      <TableRow key={candidate.id}>
        <TableCell>
          <Checkbox
            aria-label={`Ta med ${candidate.merchant} ${formatDay(candidate.bookingDate)}`}
            checked={checked.has(candidate.id)}
            onCheckedChange={(next) => toggle(candidate.id, next)}
            disabled={saving || (atLimit && !checked.has(candidate.id))}
          />
        </TableCell>
        <TableCell className="tabular-nums">
          {formatDay(candidate.bookingDate)}
        </TableCell>
        <TableCell>
          <div className="truncate">{candidate.merchant}</div>
          {otherTrip ? (
            <div className="truncate text-muted-foreground text-xs">
              Tilhører «{otherTrip.name}»
            </div>
          ) : null}
        </TableCell>
        <TableCell>
          <CategoryBadge
            label={candidate.category?.name ?? UNCATEGORIZED_CATEGORY_NAME}
          />
        </TableCell>
        <TableCell className="text-right">
          <TransactionAmount amountNok={candidate.amountNok} />
        </TableCell>
      </TableRow>
    );
  }

  function handleSave() {
    startSaving(async () => {
      try {
        const result = await setTripMembershipAction(change);
        if (result.ok) {
          toast.success(describeMembershipChange(result.data));
        } else {
          toast.error(result.error.message);
        }
      } catch {
        toast.error(FAILED_MESSAGE);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border">
        <Table aria-label={label} className="min-w-2xl table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="w-32" />
            <col />
            <col className="w-44" />
            <col className="w-32" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="sr-only">Med på turen</span>
              </TableHead>
              <TableHead>Dato</TableHead>
              <TableHead>Brukersted</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Beløp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {oneOff.map(renderRow)}
            {recurring.length > 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="pt-4">
                  <div className="font-medium text-sm">Faste utgifter</div>
                  <div className="text-muted-foreground text-xs">
                    Faste trekk betales vanligvis enten du reiser eller ikke.
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {recurring.map(renderRow)}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setChecked(
                new Set(
                  candidates
                    .slice(0, MAX_TRIP_MEMBERSHIP_IDS)
                    .map((candidate) => candidate.id),
                ),
              )
            }
            disabled={
              saving ||
              atLimit ||
              checkedCandidates.length === candidates.length
            }
          >
            {candidates.length > MAX_TRIP_MEMBERSHIP_IDS
              ? TRIP_SELECT_UP_TO_LABEL
              : "Velg alle"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChecked(new Set())}
            disabled={saving || checkedCandidates.length === 0}
          >
            Velg ingen
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p
            aria-live="polite"
            className="flex gap-2 text-muted-foreground text-sm tabular-nums"
          >
            <span>
              {describeSelection(
                checkedCandidates.length,
                tripCostNok(checkedCandidates),
              )}
            </span>
            {pendingChange ? (
              <span className="text-foreground">{pendingChange}</span>
            ) : null}
          </p>
          <Button onClick={handleSave} disabled={saving || unchanged}>
            {saving ? "Lagrer…" : submitLabel}
          </Button>
        </div>
      </div>
      {atLimit ? (
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {TRIP_SELECTION_LIMIT_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}

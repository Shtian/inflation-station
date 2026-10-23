import { formatNok } from "@/lib/format-nok";
import { parseIsoDate } from "@/lib/iso-date";
import {
  CADENCES,
  type Cadence,
  type IsoDay,
  type RecurringCandidate,
  roundNok,
  type SubscriptionAlert,
} from "@/lib/subscriptions/model";

export const CADENCE_LABELS: Record<Cadence, string> = {
  MONTHLY: "Månedlig",
  YEARLY: "Årlig",
};

const dayFormatter = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("nb-NO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function toUtcDate(day: IsoDay): Date {
  return parseIsoDate(day) ?? new Date(Number.NaN);
}

export function formatDay(day: IsoDay): string {
  return dayFormatter.format(toUtcDate(day));
}

/** Whole kroner when the charge has no øre, so "449 kr" does not read as "449,00 kr". */
export function formatAmount(value: number): string {
  return formatNok(value, { whole: Number.isInteger(value) });
}

export function describeAlert(
  alert: SubscriptionAlert,
  candidate: RecurringCandidate,
): string {
  switch (alert.kind) {
    case "PRICE_CHANGE":
      return `${formatAmount(alert.fromNok)} → ${formatAmount(alert.toNok)} fra ${monthFormatter.format(toUtcDate(alert.changedOn))}`;
    case "MISSED_CHARGE":
      return `ikke trukket siden ${formatDay(candidate.lastChargeDate)}`;
    case "CHARGED_AFTER_END":
      return `trukket igjen ${formatDay(alert.chargedOn)} etter at du avsluttet`;
  }
}

/** What the alert does to the yearly cost, or null when there is no meaningful figure. */
export function describeYearlyImpact(
  alert: SubscriptionAlert,
  candidate: RecurringCandidate,
): string | null {
  if (alert.kind !== "PRICE_CHANGE") {
    return null;
  }
  const yearly = roundNok(
    (alert.toNok - alert.fromNok) * CADENCES[candidate.cadence].perYear,
  );
  return `${yearly > 0 ? "+" : "−"}${formatAmount(Math.abs(yearly))}/år`;
}

export function describeExcludedFromTotals(
  excluded: readonly RecurringCandidate[],
): string | null {
  if (excluded.length === 0) {
    return null;
  }
  if (excluded.length === 1) {
    const [only] = excluded;
    return `Ekskl. ${only.displayName}, som ikke er trukket siden ${formatDay(only.lastChargeDate)}.`;
  }
  return `Ekskl. ${excluded.length} faste trekk som ikke er trukket som forventet.`;
}

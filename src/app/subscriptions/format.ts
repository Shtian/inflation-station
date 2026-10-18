import { formatNok } from "@/lib/format-nok";
import { parseIsoDate } from "@/lib/iso-date";
import type {
  Cadence,
  IsoDay,
  SubscriptionAlert,
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

export function describeAlert(alert: SubscriptionAlert): string {
  switch (alert.kind) {
    case "PRICE_CHANGE":
      return `${formatAmount(alert.fromNok)} → ${formatAmount(alert.toNok)} fra ${monthFormatter.format(toUtcDate(alert.changedOn))}`;
    case "MISSED_CHARGE":
      return `Forventet trekk ${formatDay(alert.expectedOn)} mangler`;
  }
}

export function merchantTransactionsHref(normalizedMerchant: string): string {
  return `/transactions?${new URLSearchParams({ globalQuery: normalizedMerchant })}`;
}

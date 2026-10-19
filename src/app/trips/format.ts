import { formatNok } from "@/lib/format-nok";
import { parseIsoDate } from "@/lib/iso-date";
import type { IsoDay } from "@/lib/trips/summary";

const dayFormatter = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function toUtcDate(day: IsoDay): Date {
  return parseIsoDate(day) ?? new Date(Number.NaN);
}

export function formatDay(day: IsoDay): string {
  return dayFormatter.format(toUtcDate(day));
}

export function formatTripRange(startDate: IsoDay, endDate: IsoDay): string {
  return dayFormatter.formatRange(toUtcDate(startDate), toUtcDate(endDate));
}

export function formatDays(days: number): string {
  return days === 1 ? "1 dag" : `${days} dager`;
}

/** Whole kroner when there are no øre, so "6 000 kr" does not read as "6 000,00 kr". */
export function formatAmount(value: number): string {
  return formatNok(value, { whole: Number.isInteger(value) });
}

export function describeMembershipChange({
  added,
  removed,
}: {
  added: number;
  removed: number;
}): string {
  if (added > 0 && removed > 0) {
    return `${added} lagt til og ${removed} fjernet fra turen.`;
  }
  if (added > 0) {
    return `${added} lagt til i turen.`;
  }
  if (removed > 0) {
    return `${removed} fjernet fra turen.`;
  }
  return "Ingen endringer.";
}

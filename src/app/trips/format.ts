import { formatNok } from "@/lib/format-nok";
import { parseIsoDate } from "@/lib/iso-date";
import { type IsoDay, MAX_TRIP_MEMBERSHIP_IDS } from "@/lib/trips/summary";

export const TRIP_SELECTION_LIMIT_MESSAGE = `Du kan legge til opptil ${MAX_TRIP_MEMBERSHIP_IDS} transaksjoner om gangen.`;
export const TRIP_SELECT_UP_TO_LABEL = `Velg opptil ${MAX_TRIP_MEMBERSHIP_IDS}`;

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

export function describeSelection(count: number, costNok: number): string {
  return `${count} valgt · ${formatAmount(costNok)}`;
}

export function describePendingChange({
  add,
  remove,
}: {
  add: number;
  remove: number;
}): string {
  return [add > 0 ? `+${add}` : "", remove > 0 ? `−${remove}` : ""]
    .filter(Boolean)
    .join(" / ");
}

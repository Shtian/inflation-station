import { formatNok, formatSignedNok } from "@/lib/format-nok";

export { formatNok, formatSignedNok };

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatMonthStartLabel(monthStart: string): string {
  const date = new Date(`${monthStart}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return monthStart;
  }

  return monthFormatter.format(date);
}

export function formatGeneratedAt(value: string | null): string {
  if (!value) {
    return "Not generated";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateTimeFormatter.format(date);
}

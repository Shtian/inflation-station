import { formatNok, formatSignedNok } from "@/lib/format-nok";

export { formatNok, formatSignedNok };

const monthFormatter = new Intl.DateTimeFormat("nb-NO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("nb-NO", {
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

export function formatMonthHeading(monthStart: string): string {
  const label = formatMonthStartLabel(monthStart);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatGeneratedAt(value: string | null): string {
  if (!value) {
    return "Ikke generert";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateTimeFormatter.format(date);
}

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const monthNameFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  timeZone: "UTC",
});

const percentFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
});

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

// "Tuesday 1 September", with the day number glued to its month so it never
// ends a line on its own.
export function formatDayLong(isoDate: string): string {
  const parts = dayFormatter.formatToParts(toUtcDate(isoDate));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

export function formatMonthName(monthStart: string): string {
  return monthNameFormatter.format(toUtcDate(monthStart));
}

export function toMonthDateRange(monthStart: string): {
  dateFrom: string;
  dateTo: string;
} {
  const start = toUtcDate(monthStart);
  const last = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  );

  return {
    dateFrom: monthStart,
    dateTo: last.toISOString().slice(0, 10),
  };
}

// Recaps are model-written with ordinary spaces, so "2 800 kr" can wrap
// mid-number. Glue digit groups and the currency to each other.
export function keepAmountsTogether(text: string): string {
  return text
    .replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00a0")
    .replace(/(\d) kr\b/g, "$1\u00a0kr");
}

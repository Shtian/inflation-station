import type { MonthlyReviewTimelineRow } from "./monthly-review-manager.types";

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

const nokFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

export function formatNok(value: number): string {
  return nokFormatter.format(value);
}

export function formatSignedNok(
  value: number,
  mode: "positive" | "negative" | "auto" = "auto",
): string {
  const absValue = Math.abs(value);
  const formatted = formatNok(absValue);

  if (mode === "positive") {
    return `+${formatted}`;
  }

  if (mode === "negative") {
    return `-${formatted}`;
  }

  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

export function getReviewStateLabel(
  reviewState: MonthlyReviewTimelineRow["reviewState"],
): string {
  if (reviewState === "GENERATING") {
    return "Generating";
  }

  if (reviewState === "GENERATED") {
    return "Generated";
  }

  if (reviewState === "FAILED") {
    return "Failed";
  }

  return "Not generated";
}

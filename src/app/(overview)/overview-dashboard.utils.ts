import { formatNok } from "@/lib/format-nok";
import { parseIsoDate } from "@/lib/iso-date";
import type { DashboardRangePreset } from "./overview-dashboard.types";

export { formatNok };
export const ALL_ACCOUNTS_VALUE = "__all_accounts__";

export function formatCompactNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatWholeNok(value: number) {
  return formatNok(value, { whole: true });
}

export function formatPercent(ratio: number, fractionDigits = 0) {
  return new Intl.NumberFormat("nb-NO", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
}

const nameListFormatter = new Intl.ListFormat("nb-NO", {
  type: "conjunction",
});

export function formatNameList(names: string[]) {
  return nameListFormatter.format(names);
}

export function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatTooltipNok(value: unknown) {
  if (typeof value === "number") {
    return formatNok(value);
  }

  return formatNok(Number.parseFloat(String(value)) || 0);
}

export function formatChartDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function formatFullDate(value: string) {
  const date = fromDateInputValue(value);
  if (!date) {
    return "Velg en dato";
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateInputValue(value: string) {
  return parseIsoDate(value) ?? undefined;
}

export function getPresetRange(
  preset: Exclude<DashboardRangePreset, "custom">,
) {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date(endDate);

  if (preset === "30d") {
    startDate.setDate(startDate.getDate() - 29);
  } else if (preset === "90d") {
    startDate.setDate(startDate.getDate() - 89);
  } else {
    startDate.setMonth(0, 1);
  }

  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
  };
}

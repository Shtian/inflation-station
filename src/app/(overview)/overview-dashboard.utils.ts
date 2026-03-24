import { formatNok } from "@/lib/format-nok";
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
    return "Pick a date";
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
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

export function getPresetRange(
  preset: Exclude<DashboardRangePreset, "custom">,
) {
  if (preset === "all") {
    return {
      startDate: "",
      endDate: "",
    };
  }

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

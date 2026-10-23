import { formatNok } from "@/lib/format-nok";
import { parseIsoDate } from "@/lib/iso-date";
import type {
  DashboardDateRange,
  DashboardPeriod,
  DashboardRollingPreset,
} from "./overview-dashboard.types";

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

const ROLLING_PRESETS: readonly DashboardRollingPreset[] = [
  "30d",
  "90d",
  "ytd",
];
const MONTH_PARAM = /^(\d{4})-(\d{2})$/;
const CUSTOM_SEPARATOR = "..";

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function formatMonthParam(year: number, month: number) {
  return `${pad(year, 4)}-${pad(month)}`;
}

export function resolveDashboardPeriod(
  period: DashboardPeriod,
  today: Date,
): DashboardDateRange {
  switch (period.kind) {
    case "month": {
      const prefix = formatMonthParam(period.year, period.month);
      const lastDay = new Date(
        Date.UTC(period.year, period.month, 0),
      ).getUTCDate();
      return {
        startDate: `${prefix}-01`,
        endDate: `${prefix}-${pad(lastDay)}`,
      };
    }
    case "rolling": {
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      const start =
        period.preset === "ytd"
          ? new Date(year, 0, 1)
          : new Date(year, month, day - (period.preset === "30d" ? 29 : 89));
      return {
        startDate: toDateInputValue(start),
        endDate: toDateInputValue(new Date(year, month, day)),
      };
    }
    case "custom":
      return { startDate: period.startDate, endDate: period.endDate };
  }
}

export function previousMonth(today: Date): DashboardPeriod {
  const month = today.getMonth();
  return month === 0
    ? { kind: "month", year: today.getFullYear() - 1, month: 12 }
    : { kind: "month", year: today.getFullYear(), month };
}

export function formatDashboardPeriod(period: DashboardPeriod) {
  switch (period.kind) {
    case "month":
      return formatMonthParam(period.year, period.month);
    case "rolling":
      return period.preset;
    case "custom":
      return `${period.startDate}${CUSTOM_SEPARATOR}${period.endDate}`;
  }
}

export function parseDashboardPeriod(value: unknown): DashboardPeriod | null {
  if (typeof value !== "string") {
    return null;
  }

  const preset = ROLLING_PRESETS.find((candidate) => candidate === value);
  if (preset) {
    return { kind: "rolling", preset };
  }

  const monthMatch = MONTH_PARAM.exec(value);
  if (monthMatch) {
    const year = Number.parseInt(monthMatch[1], 10);
    const month = Number.parseInt(monthMatch[2], 10);
    return month >= 1 && month <= 12 ? { kind: "month", year, month } : null;
  }

  const [startDate, endDate, ...rest] = value.split(CUSTOM_SEPARATOR);
  if (
    rest.length > 0 ||
    endDate === undefined ||
    !parseIsoDate(startDate) ||
    !parseIsoDate(endDate) ||
    startDate > endDate
  ) {
    return null;
  }

  return { kind: "custom", startDate, endDate };
}

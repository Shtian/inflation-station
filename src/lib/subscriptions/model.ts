import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";

export type Cadence = "MONTHLY" | "YEARLY";

export type SubscriptionDecisionStatus = "CONFIRMED" | "DISMISSED";

type DayBand = readonly [min: number, max: number];

type CadenceRule = {
  band: DayBand;
  /** Interval band when one charge in between is missing, or null when a gap disqualifies the cadence. */
  skipBand: DayBand | null;
  graceDays: number;
  perYear: number;
  addPeriod: (date: Date, periods: number) => Date;
};

export const CADENCES: Record<Cadence, CadenceRule> = {
  MONTHLY: {
    band: [27, 33],
    skipBand: [54, 66],
    graceDays: 7,
    perYear: 12,
    addPeriod: addMonths,
  },
  YEARLY: {
    band: [355, 375],
    skipBand: null,
    graceDays: 30,
    perYear: 1,
    addPeriod: addYears,
  },
};

/** `yyyy-mm-dd` calendar day. */
export type IsoDay = string;

export type Charge = {
  transactionId: string;
  date: IsoDay;
  /** Positive NOK spent. */
  amountNok: number;
};

export type RecurringCandidate = {
  key: string;
  normalizedMerchant: string;
  displayName: string;
  cadence: Cadence;
  /** Ascending by date. */
  charges: Charge[];
  typicalAmountNok: number;
  currentAmountNok: number;
  annualizedNok: number;
  lastChargeDate: IsoDay;
  nextExpectedDate: IsoDay;
};

export type SubscriptionAlert =
  | { kind: "PRICE_CHANGE"; fromNok: number; toNok: number; changedOn: IsoDay }
  | { kind: "MISSED_CHARGE"; expectedOn: IsoDay; daysOverdue: number };

export function daysBetween(from: IsoDay, to: IsoDay): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

export function addCadencePeriod(day: IsoDay, cadence: Cadence): IsoDay {
  return format(CADENCES[cadence].addPeriod(parseISO(day), 1), "yyyy-MM-dd");
}

export function roundNok(value: number): number {
  return Math.round(value * 100) / 100;
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

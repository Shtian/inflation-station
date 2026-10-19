import type { CategoryKind } from "@prisma/client";
import { UNCATEGORIZED_CATEGORY_NAME } from "@/lib/category-color";
import { isTransfer } from "@/lib/transactions/transfer";

/** `YYYY-MM-DD`, a UTC calendar day. */
export type IsoDay = string;

export type Trip = {
  id: string;
  name: string;
  startDate: IsoDay;
  /** Inclusive, never before `startDate`. */
  endDate: IsoDay;
};

/** A transaction as the trips feature sees it. Deliberately not `TransactionRow`. */
export type TripTransaction = {
  id: string;
  bookingDate: IsoDay;
  /** Signed: spend is negative, refunds and income are positive. */
  amountNok: number;
  merchant: string;
  category: { name: string; kind: CategoryKind } | null;
  trip: { id: string; name: string } | null;
};

export type CategoryCost = {
  /** `UNCATEGORIZED_CATEGORY_NAME` for uncategorized rows, so the badge gets the neutral colour. */
  categoryName: string;
  /** Net cost, positive means money out. */
  costNok: number;
};

export type TripTotals = {
  days: number;
  /** Net cost of the tagged non-transfer rows, positive means money out. */
  costNok: number;
  perDayNok: number;
};

export type TripSummary = Trip &
  TripTotals & {
    /** Highest cost first; categories that net to zero are left out. */
    byCategory: CategoryCost[];
    /** Booked before the start date, oldest first. Transfers are listed but not counted. */
    beforeTrip: TripTransaction[];
    /** Booked on or after the start date, oldest first. */
    duringTrip: TripTransaction[];
  };

export type TripListItem = Trip & TripTotals & { transactionCount: number };

export type TripCandidate = TripTransaction & { defaultChecked: boolean };

/** The only membership mutation. `remove` only clears rows still on `tripId`. */
export type TripMembershipChange = {
  tripId: string;
  add: string[];
  remove: string[];
};

const DAY_MS = 86_400_000;

function roundOre(value: number): number {
  // Adding 0 turns -0 into 0, so an empty trip reads "0 kr", not "-0 kr".
  return Math.round(value * 100) / 100 + 0;
}

function utcMs(day: IsoDay): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

export function daysInclusive(startDate: IsoDay, endDate: IsoDay): number {
  return Math.round((utcMs(endDate) - utcMs(startDate)) / DAY_MS) + 1;
}

function byBookingDate(a: TripTransaction, b: TripTransaction): number {
  return a.bookingDate.localeCompare(b.bookingDate) || a.id.localeCompare(b.id);
}

export function summarizeTrip(
  trip: Trip,
  members: readonly TripTransaction[],
): TripSummary {
  const days = daysInclusive(trip.startDate, trip.endDate);
  const counted = members.filter((member) => !isTransfer(member));

  const costByCategory = new Map<string, number>();
  for (const member of counted) {
    const name = member.category?.name ?? UNCATEGORIZED_CATEGORY_NAME;
    costByCategory.set(
      name,
      (costByCategory.get(name) ?? 0) - member.amountNok,
    );
  }

  const costNok = roundOre(
    counted.reduce((sum, member) => sum - member.amountNok, 0),
  );
  const sorted = [...members].sort(byBookingDate);

  return {
    ...trip,
    days,
    costNok,
    perDayNok: roundOre(costNok / days),
    byCategory: [...costByCategory]
      .map(([categoryName, cost]) => ({
        categoryName,
        costNok: roundOre(cost),
      }))
      .filter((category) => category.costNok !== 0)
      .sort(
        (a, b) =>
          b.costNok - a.costNok || a.categoryName.localeCompare(b.categoryName),
      ),
    beforeTrip: sorted.filter((member) => member.bookingDate < trip.startDate),
    duringTrip: sorted.filter((member) => member.bookingDate >= trip.startDate),
  };
}

export function toTripListItem(
  trip: Trip,
  members: readonly TripTransaction[],
): TripListItem {
  const { days, costNok, perDayNok } = summarizeTrip(trip, members);
  return {
    ...trip,
    days,
    costNok,
    perDayNok,
    transactionCount: members.length,
  };
}

function isCheckedByDefault(
  tripId: string,
  transaction: TripTransaction,
): boolean {
  if (transaction.trip) {
    return transaction.trip.id === tripId;
  }
  if (!transaction.category) {
    return transaction.amountNok < 0;
  }
  return transaction.category.kind === "EXPENSE";
}

export function toTripCandidate(
  tripId: string,
  transaction: TripTransaction,
): TripCandidate {
  return {
    ...transaction,
    defaultChecked: isCheckedByDefault(tripId, transaction),
  };
}

/** The smallest change that makes the trip hold exactly the checked candidates. */
export function membershipChangeFor(
  tripId: string,
  candidates: readonly TripCandidate[],
  checkedIds: ReadonlySet<string>,
): TripMembershipChange {
  const add: string[] = [];
  const remove: string[] = [];

  for (const candidate of candidates) {
    const onThisTrip = candidate.trip?.id === tripId;
    const checked = checkedIds.has(candidate.id);
    if (checked && !onThisTrip) {
      add.push(candidate.id);
    } else if (!checked && onThisTrip) {
      remove.push(candidate.id);
    }
  }

  return { tripId, add, remove };
}

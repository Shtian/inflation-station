import type { Prisma, PrismaClient } from "@prisma/client";
import { parseIsoDate } from "@/lib/iso-date";
import { loadRecurringMerchants } from "@/lib/subscriptions/load";
import { transactionTextWhere } from "@/lib/transactions/list";
import {
  type IsoDay,
  summarizeTrip,
  type Trip,
  type TripCandidate,
  type TripListItem,
  type TripSummary,
  type TripTransaction,
  toTripCandidate,
  toTripListItem,
} from "./summary";

export const SEARCH_LIMIT = 50;

/** How far a typed amount may be from the stored one and still match. */
const AMOUNT_TOLERANCE_NOK = 1;

const TRIP_TRANSACTION_SELECT = {
  id: true,
  bookingDate: true,
  amountNok: true,
  merchant: true,
  normalizedMerchant: true,
  category: { select: { name: true, kind: true } },
  trip: { select: { id: true, name: true } },
} satisfies Prisma.TransactionSelect;

const TRIP_SELECT = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
} satisfies Prisma.TripSelect;

const NEWEST_FIRST = [
  { bookingDate: "desc" },
  { id: "desc" },
] satisfies Prisma.TransactionOrderByWithRelationInput[];

/** The "Legg til transaksjoner" search, parsed from the URL params q, fra, til and belop. */
export type TripSearchQuery = {
  text: string | null;
  from: IsoDay | null;
  to: IsoDay | null;
  /** Matched against the absolute amount, so 2400 finds both -2400 and 2400. */
  amountNok: number | null;
};

export type TripPageData = {
  summary: TripSummary;
  /**
   * Every row booked inside the trip's dates, newest first, members included.
   * Pre-checked by suggestion only while the trip has no members.
   */
  inRange: TripCandidate[];
  /**
   * `null` when the URL carries no search. Never lists rows already on the
   * trip. Hits start unchecked: a text search spans every date, so a
   * suggestion would tag unrelated rows.
   */
  search: {
    query: TripSearchQuery;
    results: TripCandidate[];
    truncated: boolean;
  } | null;
};

export type TripOption = Trip;

function toIsoDay(date: Date): IsoDay {
  return date.toISOString().slice(0, 10);
}

function toTrip(record: Prisma.TripGetPayload<{ select: typeof TRIP_SELECT }>) {
  return {
    id: record.id,
    name: record.name,
    startDate: toIsoDay(record.startDate),
    endDate: toIsoDay(record.endDate),
  };
}

function toTripTransaction(
  record: Prisma.TransactionGetPayload<{
    select: typeof TRIP_TRANSACTION_SELECT;
  }>,
): TripTransaction {
  return {
    id: record.id,
    bookingDate: toIsoDay(record.bookingDate),
    amountNok: record.amountNok.toNumber(),
    merchant: record.merchant ?? record.normalizedMerchant,
    normalizedMerchant: record.normalizedMerchant,
    category: record.category,
    trip: record.trip,
  };
}

function nextUtcDay(day: IsoDay): Date {
  const date = parseIsoDate(day) as Date;
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function bookedWithin(
  from: IsoDay | null,
  to: IsoDay | null,
): Prisma.TransactionWhereInput {
  return {
    bookingDate: {
      gte: from ? (parseIsoDate(from) as Date) : undefined,
      lt: to ? nextUtcDay(to) : undefined,
    },
  };
}

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function parseDay(value: string): IsoDay | null {
  return parseIsoDate(value) ? value : null;
}

/** Accepts "2400", "2 400" and "2400,50"; anything else means no amount filter. */
function parseAmount(value: string): number | null {
  const amount = Number(value.replace(/\s/g, "").replace(",", "."));
  return value && Number.isFinite(amount) ? Math.abs(amount) : null;
}

/** Malformed values are dropped, so a hand-edited URL degrades to fewer filters, not an error. */
export function parseTripSearch(
  searchParams: Record<string, string | string[] | undefined>,
): TripSearchQuery | null {
  const query: TripSearchQuery = {
    text: firstParam(searchParams.q) || null,
    from: parseDay(firstParam(searchParams.fra)),
    to: parseDay(firstParam(searchParams.til)),
    amountNok: parseAmount(firstParam(searchParams.belop)),
  };

  return Object.values(query).every((value) => value === null) ? null : query;
}

function searchWhere(
  tripId: string,
  query: TripSearchQuery,
): Prisma.TransactionWhereInput {
  const conditions: Prisma.TransactionWhereInput[] = [
    { OR: [{ tripId: null }, { tripId: { not: tripId } }] },
    bookedWithin(query.from, query.to),
  ];

  const text = transactionTextWhere(query.text ?? "");
  if (text) {
    conditions.push(text);
  }

  if (query.amountNok !== null) {
    const amount = query.amountNok;
    conditions.push({
      OR: [
        {
          amountNok: {
            gte: amount - AMOUNT_TOLERANCE_NOK,
            lte: amount + AMOUNT_TOLERANCE_NOK,
          },
        },
        {
          amountNok: {
            gte: -amount - AMOUNT_TOLERANCE_NOK,
            lte: -amount + AMOUNT_TOLERANCE_NOK,
          },
        },
      ],
    });
  }

  return { AND: conditions };
}

export async function loadTripList(db: PrismaClient): Promise<TripListItem[]> {
  const trips = await db.trip.findMany({
    select: {
      ...TRIP_SELECT,
      transactions: { select: TRIP_TRANSACTION_SELECT },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });

  return trips.map((trip) =>
    toTripListItem(toTrip(trip), trip.transactions.map(toTripTransaction)),
  );
}

export async function loadTripPage(
  db: PrismaClient,
  tripId: string,
  search: TripSearchQuery | null,
): Promise<TripPageData | null> {
  const record = await db.trip.findUnique({
    where: { id: tripId },
    select: {
      ...TRIP_SELECT,
      transactions: { select: TRIP_TRANSACTION_SELECT },
    },
  });
  if (!record) {
    return null;
  }

  const trip = toTrip(record);
  const [inRange, searchHits, recurringMerchants] = await Promise.all([
    db.transaction.findMany({
      where: bookedWithin(trip.startDate, trip.endDate),
      select: TRIP_TRANSACTION_SELECT,
      orderBy: NEWEST_FIRST,
    }),
    search
      ? db.transaction.findMany({
          where: searchWhere(tripId, search),
          select: TRIP_TRANSACTION_SELECT,
          orderBy: NEWEST_FIRST,
          take: SEARCH_LIMIT + 1,
        })
      : null,
    loadRecurringMerchants(db),
  ]);

  const inRangeMode = record.transactions.length === 0 ? "suggest" : "stored";

  return {
    summary: summarizeTrip(trip, record.transactions.map(toTripTransaction)),
    inRange: inRange.map((row) =>
      toTripCandidate(
        tripId,
        toTripTransaction(row),
        inRangeMode,
        recurringMerchants,
      ),
    ),
    search:
      search && searchHits
        ? {
            query: search,
            results: searchHits
              .slice(0, SEARCH_LIMIT)
              .map((hit) =>
                toTripCandidate(
                  tripId,
                  toTripTransaction(hit),
                  "stored",
                  recurringMerchants,
                ),
              ),
            truncated: searchHits.length > SEARCH_LIMIT,
          }
        : null,
  };
}

/** Options for the "Tur" field in the transaction edit dialog, newest first. */
export async function listTripOptions(db: PrismaClient): Promise<TripOption[]> {
  const trips = await db.trip.findMany({
    select: TRIP_SELECT,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  return trips.map(toTrip);
}

import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { parseIsoDate } from "@/lib/iso-date";
import type { TripMembershipChange } from "./summary";

const MAX_MEMBERSHIP_IDS = 500;

export const tripIdSchema = z.string().trim().min(1);

const tripDaySchema = z
  .string()
  .trim()
  .refine((value) => parseIsoDate(value) !== null, {
    message: "Datoen må ha formatet ÅÅÅÅ-MM-DD.",
  })
  .transform((value) => parseIsoDate(value) as Date);

export const tripInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Gi turen et navn.")
      .max(80, "Navnet kan ha maks 80 tegn."),
    startDate: tripDaySchema,
    endDate: tripDaySchema,
  })
  .refine((trip) => trip.endDate >= trip.startDate, {
    message: "Sluttdato kan ikke være før startdato.",
    path: ["endDate"],
  });

export type TripInput = z.infer<typeof tripInputSchema>;

const membershipIdsSchema = z
  .array(tripIdSchema)
  .max(MAX_MEMBERSHIP_IDS)
  .transform((ids) => [...new Set(ids)]);

export const tripMembershipChangeSchema = z
  .object({
    tripId: tripIdSchema,
    add: membershipIdsSchema,
    remove: membershipIdsSchema,
  })
  .refine((change) => change.add.length + change.remove.length > 0, {
    message: "Velg minst én transaksjon.",
  })
  .refine((change) => !change.add.some((id) => change.remove.includes(id)), {
    message: "En transaksjon kan ikke både legges til og fjernes.",
  }) satisfies z.ZodType<TripMembershipChange, unknown>;

export async function createTrip(
  db: PrismaClient,
  input: TripInput,
): Promise<{ id: string }> {
  return db.trip.create({ data: input, select: { id: true } });
}

/** Membership is explicit and the before/during split is read-time, so moving dates needs no resync. */
export async function updateTrip(
  db: PrismaClient,
  tripId: string,
  input: TripInput,
): Promise<{ id: string }> {
  return db.trip.update({
    where: { id: tripId },
    data: input,
    select: { id: true },
  });
}

/** `onDelete: SetNull` un-tags the members; the transactions stay. */
export async function deleteTrip(
  db: PrismaClient,
  tripId: string,
): Promise<{ id: string }> {
  return db.trip.delete({ where: { id: tripId }, select: { id: true } });
}

/**
 * Idempotent: running a change twice leaves the same rows tagged. `add` moves
 * rows off any other trip; `remove` only clears rows still on this trip, so a
 * stale checklist cannot untag a row that has since moved elsewhere. The
 * counts cover only rows that changed, so unknown ids and repeats count zero.
 */
export async function setTripMembership(
  db: PrismaClient,
  change: TripMembershipChange,
): Promise<{ added: number; removed: number }> {
  return db.$transaction(async (tx) => {
    await tx.trip.findUniqueOrThrow({
      where: { id: change.tripId },
      select: { id: true },
    });
    const added = await tx.transaction.updateMany({
      where: {
        id: { in: change.add },
        OR: [{ tripId: null }, { tripId: { not: change.tripId } }],
      },
      data: { tripId: change.tripId },
    });
    const removed = await tx.transaction.updateMany({
      where: { id: { in: change.remove }, tripId: change.tripId },
      data: { tripId: null },
    });
    return { added: added.count, removed: removed.count };
  });
}

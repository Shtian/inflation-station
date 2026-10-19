"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  executeServerMutation,
  type MutationActionError,
  type MutationActionResult,
  mutationValidationError,
} from "@/lib/server-actions/mutation-result";
import { isRecordNotFound } from "@/lib/server-actions/prisma-errors";
import {
  createTrip,
  deleteTrip,
  setTripMembership,
  tripIdSchema,
  tripInputSchema,
  tripMembershipChangeSchema,
  updateTrip,
} from "@/lib/trips/write";

type TripErrorCode = "INVALID_TRIP_PAYLOAD" | "TRIP_NOT_FOUND";

const INVALID_TRIP_MESSAGE = "Sjekk feltene og prøv igjen.";

const updateTripInputSchema = z.intersection(
  z.object({ tripId: tripIdSchema }),
  tripInputSchema,
);

const deleteTripInputSchema = z.object({ tripId: tripIdSchema });

function mapTripNotFound(
  error: unknown,
): MutationActionError<"TRIP_NOT_FOUND"> | null {
  return isRecordNotFound(error)
    ? { code: "TRIP_NOT_FOUND", message: "Fant ikke turen." }
    : null;
}

/** Trip options also feed the "Tur" field on /transactions. */
function revalidateTrips() {
  revalidatePath("/trips", "layout");
  revalidatePath("/transactions");
}

export async function createTripAction(
  input: unknown,
): Promise<
  MutationActionResult<{ id: string }, TripErrorCode | "TRIP_SAVE_FAILED">
> {
  const parsed = tripInputSchema.safeParse(input);
  if (!parsed.success) {
    return mutationValidationError(
      "INVALID_TRIP_PAYLOAD",
      INVALID_TRIP_MESSAGE,
      parsed.error,
    );
  }

  return executeServerMutation({
    execute: async () => {
      const trip = await createTrip(prisma, parsed.data);
      revalidateTrips();
      return trip;
    },
    fallbackError: {
      code: "TRIP_SAVE_FAILED",
      message: "Kunne ikke lagre turen. Prøv igjen.",
    },
  });
}

export async function updateTripAction(
  input: unknown,
): Promise<
  MutationActionResult<{ id: string }, TripErrorCode | "TRIP_SAVE_FAILED">
> {
  const parsed = updateTripInputSchema.safeParse(input);
  if (!parsed.success) {
    return mutationValidationError(
      "INVALID_TRIP_PAYLOAD",
      INVALID_TRIP_MESSAGE,
      parsed.error,
    );
  }

  const { tripId, ...trip } = parsed.data;

  return executeServerMutation({
    execute: async () => {
      const updated = await updateTrip(prisma, tripId, trip);
      revalidateTrips();
      return updated;
    },
    mapError: mapTripNotFound,
    fallbackError: {
      code: "TRIP_SAVE_FAILED",
      message: "Kunne ikke lagre turen. Prøv igjen.",
    },
  });
}

export async function deleteTripAction(
  input: unknown,
): Promise<
  MutationActionResult<{ id: string }, TripErrorCode | "TRIP_DELETE_FAILED">
> {
  const parsed = deleteTripInputSchema.safeParse(input);
  if (!parsed.success) {
    return mutationValidationError(
      "INVALID_TRIP_PAYLOAD",
      "Turen mangler en gyldig id.",
      parsed.error,
    );
  }

  return executeServerMutation({
    execute: async () => {
      const deleted = await deleteTrip(prisma, parsed.data.tripId);
      revalidateTrips();
      return deleted;
    },
    mapError: mapTripNotFound,
    fallbackError: {
      code: "TRIP_DELETE_FAILED",
      message: "Kunne ikke slette turen. Prøv igjen.",
    },
  });
}

/** The one tagging action: checklist confirm, search add and per-row removal. */
export async function setTripMembershipAction(
  input: unknown,
): Promise<
  MutationActionResult<
    { added: number; removed: number },
    TripErrorCode | "TRIP_MEMBERSHIP_SAVE_FAILED"
  >
> {
  const parsed = tripMembershipChangeSchema.safeParse(input);
  if (!parsed.success) {
    return mutationValidationError(
      "INVALID_TRIP_PAYLOAD",
      "Ugyldig utvalg av transaksjoner.",
      parsed.error,
    );
  }

  return executeServerMutation({
    execute: async () => {
      const counts = await setTripMembership(prisma, parsed.data);
      revalidateTrips();
      return counts;
    },
    mapError: mapTripNotFound,
    fallbackError: {
      code: "TRIP_MEMBERSHIP_SAVE_FAILED",
      message: "Kunne ikke oppdatere turen. Prøv igjen.",
    },
  });
}

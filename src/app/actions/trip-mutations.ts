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

/**
 * Next passes its cache revalidation; Start invalidates on the client instead.
 * It runs inside the mutation, so a throw maps to the fallback error.
 */
type AfterWrite = () => void;

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

export async function createTripMutation(
  input: unknown,
  afterWrite?: AfterWrite,
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
      afterWrite?.();
      return trip;
    },
    fallbackError: {
      code: "TRIP_SAVE_FAILED",
      message: "Kunne ikke lagre turen. Prøv igjen.",
    },
  });
}

export async function updateTripMutation(
  input: unknown,
  afterWrite?: AfterWrite,
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
      afterWrite?.();
      return updated;
    },
    mapError: mapTripNotFound,
    fallbackError: {
      code: "TRIP_SAVE_FAILED",
      message: "Kunne ikke lagre turen. Prøv igjen.",
    },
  });
}

export async function deleteTripMutation(
  input: unknown,
  afterWrite?: AfterWrite,
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
      afterWrite?.();
      return deleted;
    },
    mapError: mapTripNotFound,
    fallbackError: {
      code: "TRIP_DELETE_FAILED",
      message: "Kunne ikke slette turen. Prøv igjen.",
    },
  });
}

/** The one tagging mutation: checklist confirm, search add and per-row removal. */
export async function setTripMembershipMutation(
  input: unknown,
  afterWrite?: AfterWrite,
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
      afterWrite?.();
      return counts;
    },
    mapError: mapTripNotFound,
    fallbackError: {
      code: "TRIP_MEMBERSHIP_SAVE_FAILED",
      message: "Kunne ikke oppdatere turen. Prøv igjen.",
    },
  });
}

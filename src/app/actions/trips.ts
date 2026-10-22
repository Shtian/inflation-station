"use server";

import { revalidatePath } from "next/cache";
import {
  createTripMutation,
  deleteTripMutation,
  setTripMembershipMutation,
  updateTripMutation,
} from "./trip-mutations";

/** Trip options also feed the "Tur" field on /transactions. */
function revalidateTrips() {
  revalidatePath("/trips", "layout");
  revalidatePath("/transactions");
}

export async function createTripAction(input: unknown) {
  return createTripMutation(input, revalidateTrips);
}

export async function updateTripAction(input: unknown) {
  return updateTripMutation(input, revalidateTrips);
}

export async function deleteTripAction(input: unknown) {
  return deleteTripMutation(input, revalidateTrips);
}

/** The one tagging action: checklist confirm, search add and per-row removal. */
export async function setTripMembershipAction(input: unknown) {
  return setTripMembershipMutation(input, revalidateTrips);
}

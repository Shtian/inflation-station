import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  createTripMutation,
  deleteTripMutation,
  setTripMembershipMutation,
  updateTripMutation,
} from "@/app/actions/trip-mutations";
import { prisma } from "@/lib/prisma";
import { loadTripList, loadTripPage, parseTripSearch } from "@/lib/trips/load";

export const TRIP_SEARCH_KEYS = ["q", "fra", "til", "belop"] as const;

/** The GET search form's fields, kept as the raw strings `parseTripSearch` expects. */
export type TripSearchParams = Partial<
  Record<(typeof TRIP_SEARCH_KEYS)[number], string>
>;

export const getTripList = createServerFn({ method: "GET" }).handler(() =>
  loadTripList(prisma),
);

export const getTripPage = createServerFn({ method: "GET" })
  .validator((input: { tripId: string; search: TripSearchParams }) => input)
  .handler(async ({ data }) => {
    const page = await loadTripPage(
      prisma,
      data.tripId,
      parseTripSearch(data.search),
    );
    if (!page) {
      throw notFound();
    }
    return page;
  });

// Validation stays in the shared mutations, which own the error contract.
// `details` is typed `unknown` there, which fails the strict
// serializable-output check, though at runtime it is zod's flattened errors.
const passThrough = (input: unknown) => input;

export const createTripFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => createTripMutation(data));

export const updateTripFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => updateTripMutation(data));

export const deleteTripFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => deleteTripMutation(data));

export const setTripMembershipFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => setTripMembershipMutation(data));

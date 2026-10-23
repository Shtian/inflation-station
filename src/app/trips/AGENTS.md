# Trips Route AGENTS

Load this when working in `src/app/trips` or `src/routes/trips`.

- The `/trips` ("Turer") and `/trips/$tripId` loaders make one server-function call each (`src/routes/trips/-server.ts`) into `src/lib/trips/load.ts`. Components never compute money or dates; totals, split and pre-check state come from `src/lib/trips`.
- The loaders read the database through server functions, so cover them with the integrated spec (`tests/integrated/us-029-trips.integrated.ts`), not the stubbed suite.
- Trip page order: header, stats, category breakdown, the ledger ("Før turen"/"Under turen", or one empty line when the trip has no members), then "Rediger utvalg" with the tabs "I perioden" and "Søk". No disclosure. `TripEditTabs` is controlled (a search submit changes the initial tab) and keeps both panels mounted so switching keeps unsaved checks.
- The ledger owns removal. "Fjern" is the only way to remove a member, and its toast offers "Angre". The in-range checklist and the search only add: neither lists members, so booked-before rows stay removable.
- Mutations are the server functions in `src/routes/trips/-server.ts`, which call `src/app/actions/trip-mutations.ts`. The checklist, the search's "Legg til valgte", "Fjern" and "Angre" all call `setTripMembershipFn`, then `router.invalidate()` reruns the loader. Deleting a trip navigates to `/trips` instead, since invalidating would reload the deleted trip.
- The "Søk" search is a GET form (`q`, `fra`, `til`, `belop`), parsed once by `parseTripSearch`. Keep it in the URL; do not add a client fetch or API route for it.
- Checklists are keyed by their rows' membership so they remount from stored state after a change elsewhere on the page.
- User-facing copy and number/date formatting live in `format.ts`. `formatTripRange` is also used by the "Tur" field in the transaction edit dialog.
- Signed transaction amounts render through `TransactionAmount` (`components/trip-amount.tsx`), mono and green when positive like `/transactions`. Cost figures are positive-means-spend, so they get `font-mono tabular-nums` but never green.
- Every trips date field uses `TripDatePicker` (`components/trip-date-picker.tsx`). Pass `value`/`onValueChange` in the dialog, `name`/`defaultValue` in the GET search form.

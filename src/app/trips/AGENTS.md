# Trips Route AGENTS

Load this when working in `src/app/trips`.

- `/trips` ("Turer") and `/trips/[tripId]` are `force-dynamic` server components that make one call each into `src/lib/trips/load.ts`. Components never compute money or dates; totals, split and pre-check state come from `src/lib/trips`.
- The pages read the database directly, so cover them with the integrated spec (`tests/integrated/us-029-trips.integrated.ts`), not the stubbed suite.
- Trip page order: header, stats, category breakdown, the ledger ("Før turen"/"Under turen", or one empty line when the trip has no members), then "Rediger utvalg" with the tabs "I perioden" and "Søk". No disclosure. `TripEditTabs` is controlled (a search submit changes the server's initial tab) and keeps both panels mounted so switching keeps unsaved checks.
- The ledger owns removal. "Fjern" is the only way to remove a member, and its toast offers "Angre". The in-range checklist and the search only add: neither lists members, so booked-before rows stay removable.
- Mutations go through `src/app/actions/trips.ts`. The checklist, the search's "Legg til valgte", "Fjern" and "Angre" all call `setTripMembershipAction`; every action revalidates `/trips` (layout) and `/transactions`, which refreshes the page.
- The "Søk" search is a GET form (`q`, `fra`, `til`, `belop`), parsed once by `parseTripSearch`. Keep it in the URL; do not add a client fetch or API route for it.
- Checklists are keyed by their rows' membership so they remount from stored state after a change elsewhere on the page.
- User-facing copy and number/date formatting live in `format.ts`. `formatTripRange` is also used by the "Tur" field in the transaction edit dialog.

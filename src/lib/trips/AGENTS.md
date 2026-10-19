# Trips Domain AGENTS

Load this when working in `src/lib/trips`.

- `summary.ts` is pure and owns the shapes (`Trip`, `TripTransaction`, `TripSummary`, `TripCandidate`, `TripMembershipChange`). `summarizeTrip` is the only cost rule: cost is the negated sum of `amountNok` over non-transfer members (`isTransfer`), so refunds net; days are inclusive; uncategorized rows group under `UNCATEGORIZED_CATEGORY_NAME`; members booked before `startDate` are "before", everything else (including after `endDate`) is "during". `toTripListItem` calls it, so never compute a trip total anywhere else.
- Membership is explicit (`Transaction.tripId`), never derived from dates. The date range only picks the in-range checklist and the before/during split, so changing a trip's dates needs no resync.
- The checklist pre-check rule is `toTripCandidate`: on this trip checked, on another trip unchecked, untagged EXPENSE checked, untagged uncategorized checked when negative, INCOME/TRANSFER unchecked. It keys on `category.kind`, unlike the sign-based cost rule; keep the two separate. Search hits start unchecked.
- `membershipChangeFor` turns a checked set into the minimal `{ add, remove }`. Every tagging surface sends that one shape to `setTripMembership`.
- `load.ts` is the only Prisma read. One private `TRIP_TRANSACTION_SELECT` feeds members, in-range rows, search hits and the list; it produces `TripTransaction`, never `TransactionRow`. Search text goes through `transactionTextWhere` from `src/lib/transactions/list.ts`, so it matches what `/transactions` search matches; the amount filter (±1 kr on the absolute amount) is trip-local.
- `write.ts` owns the Zod schemas the actions reuse and the writes. `setTripMembership` is idempotent: `add` only counts rows not already on the trip, `remove` only clears rows still on this trip. Deleting a trip relies on `onDelete: SetNull` to un-tag members.
- Dates are `yyyy-mm-dd` strings at midnight UTC, like booking dates.
- Test `summary.ts` with literal values and `load.ts`/`write.ts` against `tests/support/prisma-test-db.ts`.

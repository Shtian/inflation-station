# Subscriptions Domain AGENTS

Load this when working in `src/lib/subscriptions`.

- `model.ts` owns the shapes (`RecurringCandidate`, `SubscriptionAlert`) and the `CADENCES` registry. Add a cadence as a registry row (band, optional skip band, grace days, charges per year, period step) rather than branching on cadence elsewhere.
- `detect.ts` is pure: expense transactions in, candidates out. An expense is a negative amount whose category is not a transfer (`isTransfer`); uncategorized rows count. Amounts inside the module are positive NOK.
- `review.ts` is pure: candidates, decisions per merchant (status plus the local day it was last set) and today's date in, `confirmed`/`ended`/`suggested`/`dismissed` plus totals out. Confirmed candidates get price-change and missed-charge alerts; ended candidates get a charged-after-end alert when their last charge is later than the decision. Lapsed candidates (past next expected date plus grace) drop out of suggested and dismissed, never out of confirmed or ended. Totals skip confirmed candidates with a missed charge and list them in `totals.excluded`.
- `recurringMerchants` (`review.ts`) answers "is this merchant a fixed bill?": detected merchants not DISMISSED plus every CONFIRMED or ENDED merchant. It reads raw candidates, not the review, so lapsed charges still count for old date ranges. Trips consume it through `loadRecurringMerchants` to leave recurring bills unchecked.
- `load.ts` is the only Prisma read and stays thin. `loadSubscriptionReview` and `loadRecurringMerchants` share one fetch and detection. `decisions.ts` owns the idempotent writes (upsert and `deleteMany`).
- Dates are `yyyy-mm-dd` strings. Booking dates are midnight UTC, so `load.ts` takes the UTC calendar day.

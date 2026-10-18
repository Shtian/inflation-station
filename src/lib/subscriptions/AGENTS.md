# Subscriptions Domain AGENTS

Load this when working in `src/lib/subscriptions`.

- `model.ts` owns the shapes (`RecurringCandidate`, `SubscriptionAlert`) and the `CADENCES` registry. Add a cadence as a registry row (band, optional skip band, grace days, charges per year, period step) rather than branching on cadence elsewhere.
- `detect.ts` is pure: expense transactions in, candidates out. An expense is a negative amount whose category is not a transfer (`isTransfer`); uncategorized rows count. Amounts inside the module are positive NOK.
- `review.ts` is pure: candidates, decisions per merchant and today's date in, `confirmed`/`suggested`/`dismissed` plus totals out. Alerts are computed for confirmed candidates only. Lapsed candidates (past next expected date plus grace) drop out of suggested and dismissed but stay in confirmed with a missed-charge alert.
- `load.ts` is the only Prisma read and stays thin. `decisions.ts` owns the idempotent writes (upsert and `deleteMany`).
- Dates are `yyyy-mm-dd` strings. Booking dates are midnight UTC, so `load.ts` takes the UTC calendar day.

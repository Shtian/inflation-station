# Monthly Review Domain AGENTS

Load this when working in `src/lib/monthly-review`.

- Persist one `MonthlyReview` row per calendar month (`monthStart` unique) with lifecycle fields (`status`, optional `generatedAt`, optional `errorMessage`/`reviewText`).
- `MonthlyReview.monthStart` is UTC midnight on the 1st. Build and read it only through `review-month-key.ts`; local getters on it shift the month in any zone west of UTC. Transactions, by contrast, bucket by local calendar month.
- Persist configurable system prompt in singleton `MonthlyReviewSystemPrompt` (`id = "monthly-review-system-prompt"`); treat missing/blank values as fallback-to-default.
- Keep deterministic month aggregation in `overview.ts`: spend from negative transactions only, exclude `category.kind = TRANSFER` via `isTransfer` (`src/lib/transactions/transfer.ts`), keep uncategorized rows, include review-only months.
- Compute month-over-month spend deltas only when the immediate prior calendar month exists.
- Build timeline rows via `timeline.ts` and always include explicit review states: `NOT_GENERATED`, `GENERATING`, `GENERATED`, `FAILED`.
- Keep per-month "month in review" facts in `month-in-review.ts`: `buildMonthInReview` is the pure aggregation (cashflow, previous month, category movers, income sources, `bills`, `everyday`) and `getMonthInReview` loads the month plus prior month with local calendar bounds. `getMonthInReviewWithReview` adds `adjacentMonths` (nearest months with non-transfer bookings) and the persisted review state through `timeline.ts`'s `toReviewState`.
- Spend splits by `toSpendKind`: `paymentType === "EFT"` (direct debit, eFaktura) is a bill, everything else is everyday. Categories and cashflow cover all spend; top merchants, biggest purchase, busiest day and daily spend cover everyday spend only. Classify through `toSpendKind`, never with an inline `paymentType` check.
- Build generation input in `generation-input.ts` with validated `monthStart` (`YYYY-MM-01`), resolved prompt fallback, full-month minimal transaction rows, and `facts` from `buildMonthInReview`. The AI sees the same facts the deck slides show; do not add a parallel aggregation.
- Keep generation orchestration in `generation.ts` with replace semantics (`GENERATING` reset, then `GENERATED`/`FAILED`).
- For transfer-handling changes, update `src/lib/monthly-review/overview.test.ts`, `src/lib/monthly-review/month-in-review.test.ts`, `src/lib/monthly-review/generation-input.test.ts`, and `src/lib/dashboard/analytics.test.ts`.

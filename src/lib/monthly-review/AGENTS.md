# Monthly Review Domain AGENTS

Load this when working in `src/lib/monthly-review`.

- Persist one `MonthlyReview` row per calendar month (`monthStart` unique) with lifecycle fields (`status`, optional `generatedAt`, optional `errorMessage`/`reviewText`).
- Persist configurable system prompt in singleton `MonthlyReviewSystemPrompt` (`id = "monthly-review-system-prompt"`); treat missing/blank values as fallback-to-default.
- Keep deterministic month aggregation in `overview.ts`: spend from negative transactions only, exclude `category.kind = TRANSFER` via `isTransfer` (`src/lib/transactions/transfer.ts`), keep uncategorized rows, include review-only months.
- Compute month-over-month spend deltas only when the immediate prior calendar month exists.
- Build timeline rows via `timeline.ts` and always include explicit review states: `NOT_GENERATED`, `GENERATING`, `GENERATED`, `FAILED`.
- Keep per-month "month in review" facts in `month-in-review.ts`: `buildMonthInReview` is the pure aggregation (cashflow, previous month, category movers, top merchants, income sources, biggest purchase, busiest day) and `getMonthInReview` loads the month plus prior month with UTC bounds. `getMonthInReviewWithReview` attaches the persisted review state through `timeline.ts`'s `toReviewState`.
- Build generation input in `generation-input.ts` with validated `monthStart` (`YYYY-MM-01`), resolved prompt fallback, full-month minimal transaction rows, and `facts` from `buildMonthInReview`. The AI sees the same facts the deck slides show; do not add a parallel aggregation.
- Keep generation orchestration in `generation.ts` with replace semantics (`GENERATING` reset, then `GENERATED`/`FAILED`).
- For transfer-handling changes, update `src/lib/monthly-review/overview.test.ts`, `src/lib/monthly-review/month-in-review.test.ts`, `src/lib/monthly-review/generation-input.test.ts`, and `src/lib/dashboard/analytics.test.ts`.

# Dashboard Domain AGENTS

Load this when working in `src/lib/dashboard`.

- Keep aggregate analytics query logic here with stable date-bucketed numeric series.
- For spend/income analytics (`netCashflow`, `inflowOutflow`, `categoryBreakdown`), exclude transactions whose linked category has `kind = TRANSFER` while still including uncategorized rows.
- Keep transfer-handling regression coverage aligned in `analytics.test.ts`, plus `src/lib/monthly-review/overview.test.ts` and `src/lib/monthly-review/generation-input.test.ts`.

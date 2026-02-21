# Transactions Route AGENTS

Load this when working in `src/app/transactions`.

- Keep account/pagination filter state and transactions/accounts/categories loading in `use-transactions-manager.ts`.
- Parse and serialize `/transactions` table URL state with `transactions-table-url-state.ts`; keep table params canonical (`globalQuery`, no legacy `query`) and preserve unrelated URL params.
- Fetch `/api/transactions` when account, page, or page size changes.
- Reset pagination to page 1 whenever table filters/sorting/page-size change.
- Use shadcn table primitives and keep pagination/summary text outside the table.
- Keep edit/delete dialog state local to this route and dialog markup in focused components under `components/*`.
- Submit edits/deletes via `/api/transactions/[transactionId]` and refetch current paginated query after mutations.
- Keep NOK-only currency in this edit flow.
- Render a dedicated notes column with explicit empty-state text for null notes.

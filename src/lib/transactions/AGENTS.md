# Transactions Domain AGENTS

Load this when working in `src/lib/transactions`.

- Keep transaction query/mutation logic in this folder; API handlers should stay thin.
- Persist notes as nullable plain text (`null` when absent).
- Normalize optional note payloads before create/update writes to keep mutation shapes deterministic.
- Keep note length limits centralized in `note.ts` and enforce the same rule in import submit and transaction update flows.
- For date-range list filters, treat `dateTo` as inclusive day-boundary by querying `< next UTC day` to avoid dropping rows with non-midnight timestamps.
- For list sorting, always append a deterministic `id` tiebreaker in `orderBy` to keep pagination stable across pages.

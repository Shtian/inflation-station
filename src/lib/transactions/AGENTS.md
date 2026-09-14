# Transactions Domain AGENTS

Load this when working in `src/lib/transactions`.

- Keep transaction query/mutation logic in this folder; API handlers should stay thin.
- Module layout: `row.ts` owns what a transaction row is, `write.ts` owns what a manual create/update means, `list.ts` owns filtering and pagination, `delete.ts` owns removal, `merchant.ts` owns the merchant key (`normalizeMerchantKey`, `MerchantColumns`, `toMerchantColumns`), `note.ts` is the note-limit constant leaf.
- `row.ts` is the single Prisma `select` (`TRANSACTION_ROW_SELECT`) and the single record-to-row projection (`toTransactionRow`). Every transaction-returning query uses both; never inline a second select or projection.
- `TransactionRowRecord` is derived from the select via `Prisma.TransactionGetPayload`, so a select change cannot silently outrun the record type. The public `TransactionRow` stays hand-written; it is the contract routes and the browser read.
- Writing the display merchant always writes the derived `normalizedMerchant` in the same statement. `merchant.ts` models them as one `MerchantColumns` field so half a rename is not expressible.
- Every writer stores `normalizeMerchantKey(display)` in `normalizedMerchant`, and `list.ts` folds the search query through the same function before matching that column. Do not add a second normalizer; the fold is pinned by dedupe fingerprints on existing rows.
- Rows written before the shared key are not bulk repaired; they converge when next edited, and the raw `merchant` search leg still finds them.
- Currency is never accepted from a caller; `write.ts` pins it to `TRANSACTION_CURRENCY` on create only, and an update leaves the stored currency alone.
- Canonicalization lives in the Zod schemas, so parsed payloads are domain values: booking date is midnight UTC, note is trimmed text or `null`, merchant carries both columns.
- `YYYY-MM-DD` parsing lives in `src/lib/iso-date.ts` (`parseIsoDate`), the one parser shared by these schemas and the API date filters; it rejects a day that does not exist, so never add a second shape-only regex.
- Update intents are tri-state per field: omitted preserves, `null` clears, a value writes. Prisma reads `undefined` as "leave this column alone", so both writers stay flat object literals with no conditional spreads.
- Persist notes as nullable plain text (`null` when absent); empty and whitespace-only notes normalize to `null` on both create and update.
- Keep note length limits centralized in `note.ts` and enforce the same rule in import submit and transaction update flows. The 500 cap applies after trimming.
- `write.ts` maps no Prisma errors; P2025/P2002/P2003 mapping stays in the route handlers.
- For date-range list filters, treat `dateTo` as inclusive day-boundary by querying `< next UTC day` to avoid dropping rows with non-midnight timestamps.
- For list sorting, always append a deterministic `id` tiebreaker in `orderBy` to keep pagination stable across pages.
- Test writes against a real temporary database with `tests/support/prisma-test-db.ts`, asserting persisted columns and returned rows. Do not assert Prisma call arguments.

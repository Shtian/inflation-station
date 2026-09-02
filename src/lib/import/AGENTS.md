# Import Domain AGENTS

Load this when working in `src/lib/import`.

- Parser modules return typed valid rows, structured row-level validation errors, and stable summary shape: `imported`, `duplicates`, `ignoredReserved`, `invalid`.
- Keep merchant/payment-type normalization centralized in `normalization.ts` (including Nordic character folding) and run it before fingerprint-based dedupe/warning checks.
- Build dedupe fingerprints from `accountId`, `bookingDate`, `amountNok`, `normalizedMerchant`, `paymentType` and keep aligned with the Prisma unique constraint.
- Normalize provider payment labels (for example `Kort`) to Prisma `PaymentType` before dedupe and persistence.
- `review-stage.ts` and `review-submit.ts` are the sole persistence seam for CSV imports — there is no direct-import path. Do not add a second way to write imported `Transaction` rows.
- `stageParsedImportRows` creates the `ImportReviewSession` + `ImportReviewRow` rows and persists the session's server-owned `invalidCount` inside one `db.$transaction`; only the DB writes (not parsing, provider detection, rule matching, duplicate warnings, or AI cleanup) belong inside that transaction.
- `submitImportReview` performs session loading, decision validation (duplicate/unknown row IDs), category validation, transaction insertion, and session deletion inside one `db.$transaction`. A missing or already-consumed session is a stable not-found error (idempotent: a consumed session cannot be resubmitted). The submitted decision list may be a subset of staged rows; unselected rows are discarded with the session on consume.
- The submit summary's `invalid` count always comes from the session's persisted `invalidCount`, never from caller input.
- Keep review edits ephemeral until explicit submit; apply approved categories and clear related suggestions atomically.
- Prefill review `categoryId` using deterministic category-rule matching and leave unresolved rows uncategorized.
- Keep AI categorization optional behind `OPENAI_API_KEY`; provider/network failures must not fail parse/staging/submit flow.
- OpenAI cleanup is best-effort only; surface stable unavailable reason codes: `disabled`, `key_missing`, `timeout`, `provider_error`.
- Provider detection returns diagnostics with confidence (`certain`, `uncertain`, `missing`) and must require explicit `providerId` for unresolved detection.
- Provider transforms must load `ImportProviderMapping` + `ImportProviderFieldMapping` before canonical row staging.
- Test atomicity claims against `test-support/staged-lifecycle-db.ts` (a real, migrated, disposable SQLite database), not mocks — see `staged-import-lifecycle.test.ts`.

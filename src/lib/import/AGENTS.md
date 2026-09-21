# Import Domain AGENTS

Load this when working in `src/lib/import`.

- Parser modules return typed valid rows, structured row-level validation errors, and stable summary shape: `imported`, `duplicates`, `ignoredReserved`, `invalid`.
- Keep merchant/payment-type normalization centralized in `normalization.ts` and run it before fingerprint-based dedupe/warning checks. The fold and token algorithm itself is `normalizeMerchantKey` in `src/lib/transactions/merchant.ts`; `normalizeImportToken` delegates to it.
- Build dedupe fingerprints from `accountId`, `bookingDate`, `amountNok`, `normalizedMerchant`, `paymentType` and keep them aligned with the in-application dedupe in `transaction-dedupe.ts`. There is no database unique constraint on `Transaction`; it was dropped deliberately, so do not re-add one.
- Normalize provider payment labels (for example `Kort`) to Prisma `PaymentType` before dedupe and persistence.
- Keep review edits ephemeral until explicit submit; apply approved categories and clear related suggestions atomically.
- Prefill review `categoryId` using deterministic category-rule matching and leave unresolved rows uncategorized.
- Keep AI categorization optional behind `OPENAI_API_KEY`; provider/network failures must not fail parse/staging/submit flow.
- OpenAI cleanup is best-effort only; the four reason codes stay stable but split by who can produce them: `disabled` and `key_missing` (`CleanupDisabledReason`, `message-cleanup/reasons.ts`) are decided once at parse time before any chunk exists, while `timeout` and `provider_error` (`ChunkFailureReason`) can only come from a chunk response. `stageParsedImportRows` never calls a model; cleanup planning and chunk execution live entirely in `message-cleanup/*`.
- Provider detection returns diagnostics with confidence (`certain`, `uncertain`, `missing`) and must require explicit `providerId` for unresolved detection.
- `stageParsedImportRows` takes canonical `CsvParserResult` (`{ accountId, parsed }`) and must not import a parser module or choose between parser implementations; callers resolve a provider adapter (persisted or built-in) and pass its `parse()` output in.
- CSV tokenization and header normalization (`normalizeCsvHeader`, `tokenizeCsv`, `inferCsvDelimiter`, `createCsvStatement`) live in `provider-adapter/csv-statement.ts`; new CSV lexical logic belongs there, not re-implemented per parser.
- PDF statement extraction lives in `pdf/`. A `PdfStatementExtractor` per provider in `pdf/providers/*`, registered in `pdf/registry.ts`; detection is by issuer letterhead text, never by filename. Extractors emit `CsvParserResult` directly and bypass the provider-mapping system, which cannot express a two-column page, a multi-line record, or a sign flip.
- Every PDF extractor must return a `reconciliation` whenever the statement carries opening and closing balances, and `statementDriftNok` must be zero for a correct parse. Drift is the only defence against silently dropping a row, so never assert row counts without it.

# Import Domain AGENTS

Load this when working in `src/lib/import`.

- Parser modules return typed valid rows, structured row-level validation errors, and stable summary shape: `imported`, `duplicates`, `ignoredReserved`, `invalid`.
- Keep merchant/payment-type normalization centralized in `normalization.ts` (including Nordic character folding) and run it before fingerprint-based dedupe/warning checks.
- Build dedupe fingerprints from `accountId`, `bookingDate`, `amountNok`, `normalizedMerchant`, `paymentType` and keep aligned with the Prisma unique constraint.
- Normalize provider payment labels (for example `Kort`) to Prisma `PaymentType` before dedupe and persistence.
- Keep review edits ephemeral until explicit submit; apply approved categories and clear related suggestions atomically.
- Prefill review `categoryId` using deterministic category-rule matching and leave unresolved rows uncategorized.
- Keep AI categorization optional behind `OPENAI_API_KEY`; provider/network failures must not fail parse/staging/submit flow.
- OpenAI cleanup is best-effort only; surface stable unavailable reason codes: `disabled`, `key_missing`, `timeout`, `provider_error`.
- Provider detection returns diagnostics with confidence (`certain`, `uncertain`, `missing`) and must require explicit `providerId` for unresolved detection.
- Provider transforms must load `ImportProviderMapping` + `ImportProviderFieldMapping` before canonical row staging.
- CSV tokenization and header normalization (`normalizeCsvHeader`, `tokenizeCsv`, `inferCsvDelimiter`, `createCsvStatement`) live in `provider-adapter/csv-statement.ts`; new CSV lexical logic belongs there, not re-implemented per parser.

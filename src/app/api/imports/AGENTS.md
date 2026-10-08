# Imports API AGENTS

Load this when working in `src/app/api/imports`.

- Stage parse results into `ImportReviewSession`/`ImportReviewRow` before persistence.
- `/api/imports/parse` CSV branch: with no `columnMapping` in the request and no saved account mapping matching the file's header signature, it stages nothing and returns `{ mappingRequired: true, columnMapping: { headers, sampleRows, guess } }`. With a confirmed mapping (request field `columnMapping`, JSON) or a matching saved one, it parses with `parseMappedCsv`, stages, and echoes `columnMapping` so the client can reopen the mapping step. A malformed mapping is `400 INVALID_COLUMN_MAPPING`, one naming columns the file lacks is `400 COLUMN_MAPPING_MISMATCH`, a file with no header line is `400 CSV_HEADERS_NOT_FOUND`.
- The parse route never writes the mapping; saving it on the account is the `saveAccountCsvColumnMappingAction` Server Action's job.
- `/api/imports/submit` persists transactions from staged `sessionId` + per-row finalized decisions, then clears submitted review sessions.
- For message-cleanup settings, keep this API route read-only (`GET`); perform mutations through typed Server Actions in `src/app/actions/*`.
- Keep import APIs resilient to optional AI failures (`disabled`, `key_missing`, `timeout`, `provider_error`) and do not fail staging/submission on provider/network issues.
- `/api/imports/parse` decides CSV vs PDF from the upload's leading bytes (`%PDF-`), never from the mime type, the form field name or the filename. The PDF branch runs `extractStatementItems` then `detectPdfStatementExtractor`, reports `detection.state: "certain"`, and never touches column mapping or `createCsvStatement`. Its failures are `PDF_TEXT_EXTRACTION_FAILED`, `PDF_PROVIDER_NOT_RECOGNIZED` and `PDF_NO_TRANSACTIONS_FOUND`, all 400. Uploads over 10 MB are `413 IMPORT_FILE_TOO_LARGE` whichever branch they would take.
- `/api/imports/parse` returns `reconciliation` (`openingNok`, `closingNok`, `movementNok`, `driftNok`), `null` when the statement carries no balances. `driftNok` is computed here with `statementDriftNok`; the internal `StatementReconciliation` deliberately does not store it, so clients read it rather than re-deriving the rule.
- `/api/imports/parse` returns `cleanup: CleanupPlan` (`src/lib/import/message-cleanup/plan.ts`) instead of running message cleanup inline; it issues no OpenAI request itself.
- `/api/imports/cleanup` runs exactly one chunk per `POST {sessionId, chunkIndex}`. It re-derives chunk boundaries with `planCleanupChunks` from the session's persisted rows rather than reading stored chunk state, and it writes nothing back to the database.

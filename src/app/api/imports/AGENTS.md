# Imports API AGENTS

Load this when working in `src/app/api/imports`.

- Stage parse results into `ImportReviewSession`/`ImportReviewRow` before persistence. There is no direct-import route — every persisted CSV import crosses the staged review lifecycle in `src/lib/import/review-stage.ts` + `src/lib/import/review-submit.ts`.
- `/api/imports/parse` must return detection diagnostics and require explicit provider override when detection is unresolved with candidates.
- `/api/imports/submit` persists transactions from staged `sessionId` + per-row finalized decisions, then atomically deletes the consumed review session. The request no longer carries `invalidCount`; the response's `summary.invalid` comes from the server-owned count persisted on the session at staging time.
- Map lifecycle domain errors to stable codes: `ImportReviewSessionNotFoundError` → 404 `IMPORT_REVIEW_SESSION_NOT_FOUND`, `InvalidImportReviewCategoryError` → 400 `INVALID_IMPORT_REVIEW_CATEGORY`, `DuplicateImportReviewRowDecisionError` → 400 `DUPLICATE_IMPORT_REVIEW_ROW_DECISION`, `UnknownImportReviewRowDecisionError` → 400 `UNKNOWN_IMPORT_REVIEW_ROW_DECISION`.
- For message-cleanup settings, keep this API route read-only (`GET`); perform mutations through typed Server Actions in `src/app/actions/*`.
- Keep import APIs resilient to optional AI failures (`disabled`, `key_missing`, `timeout`, `provider_error`) and do not fail staging/submission on provider/network issues.

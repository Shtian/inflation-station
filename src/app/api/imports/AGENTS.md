# Imports API AGENTS

Load this when working in `src/app/api/imports`.

- Stage parse results into `ImportReviewSession`/`ImportReviewRow` before persistence.
- `/api/imports/parse` must return detection diagnostics and require explicit provider override when detection is unresolved with candidates.
- `/api/imports/submit` persists transactions from staged `sessionId` + per-row finalized decisions, then clears submitted review sessions.
- Keep import APIs resilient to optional AI failures (`disabled`, `key_missing`, `timeout`, `provider_error`) and do not fail staging/submission on provider/network issues.

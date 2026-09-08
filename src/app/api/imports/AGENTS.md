# Imports API AGENTS

Load this when working in `src/app/api/imports`.

- Stage parse results into `ImportReviewSession`/`ImportReviewRow` before persistence.
- `/api/imports/parse` must return detection diagnostics and require explicit provider override when detection is unresolved with candidates.
- `/api/imports/submit` persists transactions from staged `sessionId` + per-row finalized decisions, then clears submitted review sessions.
- For message-cleanup settings, keep this API route read-only (`GET`); perform mutations through typed Server Actions in `src/app/actions/*`.
- Keep import APIs resilient to optional AI failures (`disabled`, `key_missing`, `timeout`, `provider_error`) and do not fail staging/submission on provider/network issues.
- `/api/imports/parse` loads every persisted provider mapping exactly once via `loadProviderAdapters` (`src/lib/import/provider-adapter/repository.ts`) and reuses that same compiled adapter list for automatic detection and for an explicit `providerId` selection — never reload a provider mapping in a second query. A `providerId` that matches no persisted mapping is `400 PROVIDER_NOT_FOUND`; a `providerId` whose mapping failed compilation is `400 PROVIDER_MAPPING_CONFIGURATION_ERROR` (never a silent fallback to another adapter).

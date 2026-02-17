# PRD: Multi-Provider CSV Import Framework with Optional AI Message Cleanup

## 1. Introduction/Overview

The current importer assumes one bank CSV schema. This PRD defines a multi-provider import framework that supports providers like Amex with differing columns, while preserving deterministic dedupe and categorization behavior.

The feature introduces provider-aware parsing/mapping and a review workflow where transaction message cleanup can be suggested by OpenAI and accepted or rejected per row before persistence.

## 2. Goals

- Support multiple bank CSV schemas through a reusable provider mapping framework.
- Auto-detect provider from CSV headers/patterns with manual fallback selection.
- Add a simple admin UI to define and maintain provider column mappings and normalization rules.
- Keep dedupe deterministic by applying provider-specific normalization before fingerprint generation.
- Offer optional OpenAI-based transaction message cleanup suggestions without making import success dependent on AI availability.
- Let users opt out per row from AI message suggestion before rows are persisted.

## 3. User Stories

### US-001: Auto-detect provider with manual fallback
**Description:** As a user, I want the system to detect my CSV provider automatically so I can import quickly, but still override detection when needed.

**Acceptance Criteria:**
- [ ] Import parse flow attempts provider detection using header/pattern rules.
- [ ] If confidence is low or no match is found, UI requires manual provider selection.
- [ ] Manual selection can override detected provider before parsing continues.
- [ ] Detection result is surfaced in the parse response for diagnostics.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Manage provider mappings in admin UI
**Description:** As an admin, I want to configure provider field mappings so new bank schemas can be supported without code changes for every variation.

**Acceptance Criteria:**
- [ ] Admin can create/update provider mapping definitions (provider name, required source columns, target canonical fields).
- [ ] Mapping validation blocks save when required canonical fields are missing.
- [ ] Admin can define provider-specific value normalization rules for payment-type labels and merchant/message cleanup pre-processing.
- [ ] Mapping changes are versioned or timestamped so diagnostics can reference which mapping was used.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Parse CSV rows into canonical import rows per provider
**Description:** As a user, I want provider-specific CSV rows transformed into the existing canonical import row shape so review and persistence remain consistent.

**Acceptance Criteria:**
- [ ] Parse pipeline loads the selected/detected provider mapping and transforms rows to canonical fields used by existing importer conventions.
- [ ] Row-level validation errors are returned in structured diagnostics.
- [ ] Parse summary keeps stable shape: `imported`, `duplicates`, `ignoredReserved`, `invalid`.
- [ ] Payment-type labels are normalized to Prisma `PaymentType` enum values before dedupe fingerprint generation.
- [ ] Typecheck/lint passes.

### US-004: Apply provider-specific normalization before duplicate detection
**Description:** As a user, I want duplicates identified consistently across providers so repeat uploads are deterministic.

**Acceptance Criteria:**
- [ ] Provider-specific normalization runs before dedupe fingerprint creation.
- [ ] Fingerprint remains based on `accountId`, `bookingDate`, `amountNok`, `normalizedMerchant`, and `paymentType`.
- [ ] Duplicate warnings in review are computed from normalized canonical values.
- [ ] Existing Prisma uniqueness behavior remains aligned with fingerprint logic.
- [ ] Typecheck/lint passes.

### US-005: Review optional OpenAI message cleanup suggestions per row
**Description:** As a user, I want AI cleanup suggestions for transaction messages, with per-row opt-out, so I can improve merchant/message quality without losing control.

**Acceptance Criteria:**
- [ ] During review, each row can show an optional OpenAI-suggested cleaned message (when available).
- [ ] Each row has an explicit toggle or choice to apply original message vs AI-cleaned message.
- [ ] Default behavior is deterministic and documented (for example: keep original unless user opts in, or apply suggestion unless user opts out).
- [ ] If `OPENAI_API_KEY` is missing or provider call fails/timeouts, review still loads and import remains possible.
- [ ] Chosen message value per row is what is persisted on submit.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Keep AI suggestion pipeline non-blocking and auditable
**Description:** As a maintainer, I want AI enhancement to be optional and traceable so imports are reliable and debugging is practical.

**Acceptance Criteria:**
- [ ] AI suggestion step executes as best-effort enrichment and never hard-fails parse/review/submit flows.
- [ ] Review/session payload includes reason codes for missing AI suggestions (disabled, key missing, timeout, provider error).
- [ ] Logs/diagnostics avoid sensitive raw data leakage while retaining enough metadata for support.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: The system must support a provider registry abstraction for CSV import providers, including schema identification and canonical field mapping.
- FR-2: The system must auto-detect provider based on configurable header/pattern matching and allow manual override.
- FR-3: The system must provide an admin interface to create, edit, and validate provider mapping configurations.
- FR-4: Provider mappings must transform source CSV columns into canonical importer fields used by the current import pipeline.
- FR-5: The parse API must continue returning typed valid rows, structured row-level validation errors, and stable summary counters (`imported`, `duplicates`, `ignoredReserved`, `invalid`).
- FR-6: Provider-specific normalization must run before dedupe fingerprint generation and before persistence.
- FR-7: Payment-type labels from each provider must be normalized to Prisma `PaymentType` enum values before dedupe checks.
- FR-8: Potential duplicate warnings must be calculated from canonical fingerprint fields and surfaced in review payloads without dropping rows.
- FR-9: The review workflow must support per-row message source choice (original vs AI-cleaned).
- FR-10: AI message cleanup must be optional behind `OPENAI_API_KEY` and must not fail import flow when unavailable or failing.
- FR-11: The submit API must persist row values exactly as finalized in review, including chosen message text.
- FR-12: The implementation must preserve ephemeral review behavior until explicit submit and clear submitted review sessions.

## 5. Non-Goals (Out of Scope)

- OCR/PDF statement ingestion.
- Direct bank API integrations or real-time sync.
- Historical backfill/reprocessing tooling for already imported transactions.
- Fully autonomous AI column mapping without deterministic mapping rules.
- Automatic user-level mapping wizard during upload (this phase targets simple admin mapping UI).

## 6. Design Considerations

- Reuse existing `/import` staged review flow and table patterns; avoid introducing separate review paradigms.
- In review UI, clearly distinguish original message and suggested cleaned message for each row.
- Make per-row choice explicit and scannable to reduce accidental AI overwrites.
- Provide concise confidence/error badges for provider detection and AI suggestion status.

## 7. Technical Considerations

- Keep route handlers focused on validation/error mapping and place provider parsing/normalization logic in lib modules aligned with existing architecture.
- Introduce a provider mapping model that supports required canonical fields and provider-specific normalization transforms.
- Preserve deterministic categorization ordering (priority then specificity) and keep uncategorized rows reviewable.
- Ensure AI cleanup prompt/output schema is constrained and validated before suggestions are accepted into review state.
- Add targeted tests for:
- provider auto-detection and manual override,
- mapping validation and canonical transformation,
- normalization-before-dedupe behavior,
- per-row AI opt-out persistence behavior,
- non-blocking behavior for missing key/timeouts/provider failures.

## 8. Success Metrics

- Import pipeline supports at least one new provider (for example Amex) without custom one-off code paths.
- At least 95% of rows from supported providers parse into canonical shape without manual correction for well-formed exports.
- Duplicate warning behavior remains stable across repeated uploads of the same file.
- 100% of imports succeed when AI is disabled/unavailable, assuming non-AI validations pass.
- Users can finalize per-row message choices during review without adding extra post-import edit steps.

## 9. Open Questions

- What should the default per-row message choice be when AI suggestion exists (keep original by default vs apply suggestion by default)?
- Should AI cleanup run for all rows or only rows matching heuristic signals (for example noisy merchant/message patterns)?
- Should admin mappings be global-only, or account-specific overrides should be supported in a later phase?
- Should provider detection expose a numeric confidence score in UI, or a simpler detected/uncertain label for MVP?

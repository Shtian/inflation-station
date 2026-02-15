# PRD: Route Split + Pre-Import Category Review + Soft Duplicate Detection (MVP)

## 1. Introduction/Overview

The current app experience is concentrated in one large page. This PRD defines an MVP to split key capabilities into dedicated routes and improve CSV import safety by adding a review step before database persistence.

This work addresses three problems:
- Navigation is overloaded and harder to scan because core features are grouped in one page.
- Users cannot correct categories before transactions are saved.
- Strict duplicate assumptions can incorrectly collapse legitimate same-day transactions (for example two identical bus tickets on one date).

## 2. Goals

- Introduce dedicated routes for core workflows: `overview`, `import`, `accounts`, `categories`.
- Add a pre-persistence import review step where users can change category assignments before submit.
- Replace hard duplicate blocking with soft duplicate detection so users can decide whether to keep potentially duplicate rows.
- Keep import deterministic and resilient: import should still complete when no conflicts exist.

## 3. User Stories

### US-001: Navigate between dedicated feature routes
**Description:** As a user, I want separate routes for major features so I can find and use each workflow faster.

**Acceptance Criteria:**
- [ ] App exposes route-level pages for `/overview`, `/import`, `/accounts`, and `/categories`.
- [ ] Navigation links to all four routes are visible from the primary app navigation.
- [ ] Existing functionality remains reachable through one of the new routes.
- [ ] Loading `/` redirects to one of the new routes or presents navigation to them (documented behavior).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Review imported rows before saving to database
**Description:** As a user, I want to review imported transactions and adjust category values before they are persisted.

**Acceptance Criteria:**
- [ ] After CSV parsing, user is taken to a review state/page before any row is inserted into `Transaction`.
- [ ] Review list shows each valid parsed row with current category suggestion or empty category.
- [ ] User can change category per row.
- [ ] A final submit action persists reviewed rows to the database.
- [ ] Cancel/back action exits review without persisting reviewed rows.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Apply automatic category suggestions in review
**Description:** As a user, I want category suggestions prefilled in review so I only need to fix exceptions.

**Acceptance Criteria:**
- [ ] Imported rows enter review with category suggestions from existing rule/suggestion logic when available.
- [ ] Rows without a suggestion remain uncategorized and editable.
- [ ] User edits override suggested categories for that import submission.
- [ ] Suggestion metadata does not block import when unavailable.
- [ ] Typecheck/lint passes.

### US-004: Use soft duplicate detection during import review
**Description:** As a user, I want potential duplicates flagged (not blocked) so I can keep legitimate same-day identical transactions.

**Acceptance Criteria:**
- [ ] Import pipeline flags potential duplicates using current fingerprint logic as a signal only.
- [ ] Potential duplicate rows are visibly marked in review.
- [ ] User can choose to keep flagged rows and include them in submit.
- [ ] Import is not automatically rejected solely because rows are flagged as potential duplicates.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Persist only approved reviewed rows
**Description:** As a user, I want only my reviewed/approved rows saved so import outcomes match my explicit decisions.

**Acceptance Criteria:**
- [ ] DB write occurs only after explicit submit from review.
- [ ] Category values saved reflect final edited category state from review.
- [ ] Rows excluded or canceled in review are not persisted.
- [ ] Import result summary clearly reports counts for imported, flagged duplicates, invalid, and skipped rows.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: The system must provide separate routes for `/overview`, `/import`, `/accounts`, and `/categories`.
- FR-2: The system must provide route-level navigation that allows users to move between all four routes.
- FR-3: CSV import must parse input and stage valid rows in an in-memory/session review model before persistence.
- FR-4: The review UI must allow category editing per row before submit.
- FR-5: Category suggestions must be applied before review display using existing deterministic suggestion sources when available.
- FR-6: Potential duplicates must be identified using existing dedupe fingerprint fields (`accountId`, `bookingDate`, `amountNok`, `normalizedMerchant`, `paymentType`) but treated as warnings.
- FR-7: The system must allow flagged rows to be included in final import.
- FR-8: Final import persistence must use the post-review row state only.
- FR-9: Canceling/leaving review without submit must not persist staged rows.
- FR-10: Import diagnostics/summary must include explicit counters for `imported`, `potentialDuplicates`, `invalid`, and `skipped`.

## 5. Non-Goals (Out of Scope)

- Full transaction field editing in review (MVP supports category edits only).
- Automatic merge/deduplication decisions without user confirmation.
- New ML models for categorization beyond current suggestion mechanisms.
- Historical backfill/rewrite of already persisted transactions.
- Major dashboard redesign beyond route split and required navigation updates.

## 6. Design Considerations

- Keep visual patterns consistent with current app components.
- Review UI should prioritize quick scanning: category control and duplicate warning must be visible per row.
- Route naming and labels should match user mental model: Overview, Import, Accounts, Categories.

## 7. Technical Considerations

- Preserve existing importer contract patterns (typed valid rows, row-level validation errors, stable summary shape).
- Keep review edits ephemeral until submit; avoid partial writes before confirmation.
- Align soft duplicate flagging with existing fingerprint convention and Prisma uniqueness constraints, but do not treat flags as auto-reject.
- Ensure optional OpenAI suggestion path remains non-blocking.
- Add targeted tests for:
  - route availability/navigation behavior,
  - review-stage category edit behavior,
  - soft duplicate flagging and keep behavior,
  - persistence only on submit.

## 8. Success Metrics

- Users can complete a CSV import with category edits without any DB writes before submit.
- 100% of flagged duplicate candidates remain user-decidable (no forced drop in MVP flow).
- Core navigation task completion improves: user can reach each major area in one click from primary nav.
- No regression in import completion for files without conflicts.

## 9. Open Questions

- Should flagged duplicates default to “keep” or “exclude” in the review UI?
- Should review state survive browser refresh during import session?
- Should duplicate warnings distinguish “already in DB” vs “duplicate inside current upload batch” in MVP, or defer to later iteration?

# PRD: Transaction Notes

## 1. Introduction/Overview

Add an optional plain-text note field to transactions so users can preserve personal context for future recall and downstream AI features (for example monthly summaries). Notes must be editable both during import review and after persistence from the transactions overview flow.

## 2. Goals

- Allow users to attach an optional note to each transaction during import review.
- Allow users to add or edit a transaction note after import from the transactions overview workflow.
- Persist notes in the transaction record so they remain available for future summaries and analytics features.
- Keep scope minimal: single note field, no collaboration or history.

## 3. User Stories

### US-001: Persist note field on transactions
**Description:** As a developer, I want transactions to store an optional note so user context is persisted and available for future features.

**Acceptance Criteria:**
- [ ] Add nullable note field to the transaction data model.
- [ ] Migration applies successfully in local development.
- [ ] Create/update transaction flows can persist note values.
- [ ] Typecheck/lint passes.

### US-002: Edit note during import review
**Description:** As a user importing transactions, I want to add a per-row note during review so context is captured before submit.

**Acceptance Criteria:**
- [ ] Import review UI exposes a note input for each staged row.
- [ ] Note is optional and accepts plain text up to 500 characters.
- [ ] Entered notes are included in the `/api/imports/submit` finalized row payload.
- [ ] Submitted transactions persist the provided notes.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Add/edit note from transactions overview
**Description:** As a user reviewing saved transactions, I want to add or edit a note from the transactions overview editing flow so I can maintain context over time.

**Acceptance Criteria:**
- [ ] Transactions overview edit flow includes the note field.
- [ ] Existing note is prefilled when editing a transaction.
- [ ] Clearing the field saves `null`/empty note according to API contract.
- [ ] Note edits persist through `/api/transactions/[transactionId]` update flow.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Enforce note validation and UX constraints
**Description:** As a user, I want consistent note limits and validation so behavior is predictable across import and post-import editing.

**Acceptance Criteria:**
- [ ] Both import and transactions update APIs validate note length at 500 characters max.
- [ ] Validation errors return stable, user-facing messages without failing unrelated fields.
- [ ] UI surfaces validation feedback near the note input.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 4. Functional Requirements

- FR-1: The system must support an optional `note` field on `Transaction`.
- FR-2: The system must allow per-row note entry in import review before submission.
- FR-3: Import submit must persist note values to created transactions.
- FR-4: The system must allow add/edit/clear note through the existing transactions overview edit workflow.
- FR-5: Notes must be plain text with maximum length of 500 characters.
- FR-6: Note validation must be applied consistently in both import submit and transaction update APIs.
- FR-7: Existing behavior for non-note transaction fields must remain unchanged.

## 5. Non-Goals (Out of Scope)

- Note history or audit timeline.
- Comment threads, mentions, or multi-user collaboration.
- Attachments or file uploads.
- Rich-text/markdown formatting.
- AI-generated note content in this phase.

## 6. Design Considerations

- Reuse existing import review row controls and transaction edit dialog patterns.
- Keep note input straightforward (single text input or textarea) with clear character-limit behavior.
- Do not add new route-level pages for this feature.

## 7. Technical Considerations

- Requires Prisma schema update and migration for transaction note persistence.
- Import pipeline update must carry note through staged review data into submit persistence without changing dedupe behavior.
- Transactions API update should extend existing payload validation in `src/app/api/transactions/[transactionId]`.
- Ensure any shared transaction DTO/types include note for relevant read/update flows.

## 8. Success Metrics

- Users can add a note during import review and see it persisted after submit.
- Users can edit an existing transaction note from overview in one edit flow.
- Validation rejects notes longer than 500 characters consistently across both entry points.
- No regressions in import submit success path for rows without notes.

## 9. Open Questions

- Should transaction list tables display note previews, or keep notes visible only in edit/review controls for now?
- Should future monthly summary features consume raw notes directly or a sanitized/normalized variant?

# PRD: Transaction Row Management

## 1. Introduction/Overview

Add a dedicated transaction management experience where users can view, edit, and remove existing transaction rows for their accounts. The feature should support filtering by account, use shadcn UI components, and keep list navigation performant through server-backed pagination.

## 2. Goals

- Let users browse existing transactions across all accounts with an account filter.
- Let users edit transaction data through a modal/drawer form.
- Let users remove transactions with a confirmation step to prevent accidental deletion.
- Ensure transaction lists are paginated with page number controls and a page-size selector.
- Keep interaction patterns aligned with the existing shadcn-based design system.

## 3. User Stories

### US-001: Add transactions route and list shell
**Description:** As a user, I want a dedicated place to manage transactions so that I can review historical rows without using import flows.

**Acceptance Criteria:**
- [ ] Add a route page for transaction management (for example `/transactions`) with a clear heading and list layout.
- [ ] Route is reachable from the primary app navigation.
- [ ] List view uses shadcn layout primitives (card/section/table/pagination controls).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: List transactions with account filter and pagination
**Description:** As a user, I want to filter transactions by account and paginate results so that I can find rows quickly without loading everything at once.

**Acceptance Criteria:**
- [ ] Transactions API supports account filtering and paginated responses.
- [ ] UI includes an account filter that can show all accounts or a specific account.
- [ ] UI includes numbered page controls and page-size selector.
- [ ] Total count and current page state are visible to the user.
- [ ] Empty state is shown when no rows match filters.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Edit transaction through modal or drawer
**Description:** As a user, I want to edit a transaction in a modal/drawer so that I can quickly correct row data without leaving the list.

**Acceptance Criteria:**
- [ ] Each row includes an edit action that opens a shadcn modal or drawer form.
- [ ] Form pre-fills existing values for editable fields.
- [ ] Editable scope includes all user-owned fields except immutable import metadata.
- [ ] Save action validates input and persists changes via API.
- [ ] After save, the list reflects updated values without requiring full app reload.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Delete transaction with confirmation dialog
**Description:** As a user, I want to delete a transaction with explicit confirmation so that accidental removals are less likely.

**Acceptance Criteria:**
- [ ] Each row includes a delete action.
- [ ] Delete action opens a shadcn confirmation dialog requiring explicit user confirmation.
- [ ] Confirmed delete performs hard deletion.
- [ ] Canceled delete leaves data unchanged.
- [ ] After delete, pagination state remains valid (for example, if last row on page is removed, navigate to previous valid page as needed).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Add tests for list/edit/delete behavior
**Description:** As a maintainer, I want automated coverage for transaction management behavior so that regressions are caught early.

**Acceptance Criteria:**
- [ ] Add unit/integration tests for paginated list query behavior (filtering, total count, page boundaries).
- [ ] Add tests for edit API validation and persistence behavior.
- [ ] Add tests for delete API confirmation path handling at UI/API boundaries as appropriate.
- [ ] Existing and new tests pass for changed scope.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: The system must provide an API endpoint to fetch transactions with `page`, `pageSize`, and optional `accountId` filter.
- FR-2: Paginated responses must include transaction rows plus metadata needed for UI pagination (`total`, `page`, `pageSize`, and computed total pages or equivalent).
- FR-3: The UI must allow selecting `All accounts` or a specific account when listing transactions.
- FR-4: The transaction list UI must use shadcn table primitives from `src/components/ui/table.tsx`.
- FR-5: The list UI must provide numeric page navigation and page-size selection.
- FR-6: The system must provide an update endpoint for transactions that permits editing all user-owned mutable fields and rejects immutable import metadata changes.
- FR-7: The UI must provide per-row edit action that opens a shadcn modal/drawer and submits updates.
- FR-8: The system must provide a delete endpoint that hard-deletes a transaction by id.
- FR-9: The UI must provide per-row delete action with shadcn confirmation dialog before executing delete.
- FR-10: After edit or delete, the list data must refresh while preserving active filter and valid pagination state.

## 5. Non-Goals (Out of Scope)

- Bulk edit or bulk delete operations.
- Soft delete and restore workflow.
- Audit trail/history viewer for field-level transaction changes.
- Advanced search language, saved views, or multi-filter query builder.
- CSV import workflow changes beyond keeping compatibility with edited/deleted rows.

## 6. Design Considerations

- Reuse shadcn components already present in the codebase (table, dialog, select, button, input, card, separator).
- Keep list and actions consistent with established route page layout conventions (no duplicate headings, avoid unnecessary nested bordered cards).
- Use semantic theme tokens to remain light/dark compatible.
- Ensure responsive behavior on mobile: horizontal table scrolling, usable modal/drawer interaction, and accessible pagination controls.

## 7. Technical Considerations

- Follow existing route/API architecture: App Router UI routes and `src/app/api/**` handlers with shared Prisma client.
- Keep pagination deterministic with explicit sort order (for example booking date desc, then id desc) to avoid row jumps between page loads.
- Validate request payloads with existing validation approach (zod if already used in adjacent handlers).
- Ensure delete/edit actions do not break existing dedupe or categorization workflows that rely on remaining transaction data.
- Add or extend tests in the existing testing setup (Vitest for unit/integration, Playwright for E2E if UI behavior coverage is added).

## 8. Success Metrics

- Users can open transaction management and locate a target row using account filter and pagination without loading all rows.
- Users can complete a single-row edit flow in one modal/drawer interaction and see updated values in the list immediately.
- Users can delete a row only after explicit confirmation.
- No regressions in lint/typecheck/tests for touched transaction workflows.
- Pagination remains stable and responsive on datasets larger than one page.

## 9. Open Questions

- Should transaction management live at `/transactions` or be nested under an existing route?
- Which exact fields are classified as immutable import metadata in current schema/API contracts?
- Should pagination/filter state be encoded in URL search params for shareable views and back/forward behavior?

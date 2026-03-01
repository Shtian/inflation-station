# PRD: Transactions Table Migration to shadcn Data Table + TanStack Table

## 1. Introduction/Overview

Migrate the existing `/transactions` list UI to the shadcn Data Table pattern powered by `@tanstack/react-table`, with a focus on better day-to-day usability. The feature will add first-class sorting, filtering, and column visibility controls, and replace current pagination controls with the shadcn/TanStack pagination pattern while preserving the current transactions domain behavior.

This phase is limited to the transactions list and should keep existing edit/delete row actions working.

## 2. Goals

- Improve transaction-list usability by making table controls (sort/filter/columns/page) clearer and faster.
- Add phase-1 filters: global text search, date range, and account/category filtering.
- Support sortable columns for key transaction fields.
- Add column visibility toggles with session-only persistence.
- Adopt shadcn/TanStack pagination UX and state model.
- Sync table state to URL search params so refresh, back/forward, and shareable links preserve state.

## 3. User Stories

### US-001: Adopt TanStack table state in transactions list
**Description:** As a user, I want the transactions table to behave like a modern data table so that sorting, filtering, and pagination feel consistent and predictable.

**Acceptance Criteria:**
- [ ] Replace current ad-hoc table state handling with `@tanstack/react-table` table state for sorting, filters, visibility, and pagination.
- [ ] Existing transaction row rendering still includes date, merchant, notes indicator, category, payment type, amount, and row actions.
- [ ] Existing edit and delete row actions continue to work after migration.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Add global search + date range + account/category filters
**Description:** As a user, I want to narrow transactions quickly with practical filters so that I can find specific rows without paging manually.

**Acceptance Criteria:**
- [ ] Add a global text filter input for transaction rows.
- [ ] Add date range filtering with explicit start and end date inputs.
- [ ] Keep account filter support and add/keep category filter support in table controls.
- [ ] Applying any filter resets pagination to page 1.
- [ ] Empty state text appears when no rows match active filters.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Add sortable columns
**Description:** As a user, I want to sort transaction columns so that I can analyze recent, largest, or grouped transactions faster.

**Acceptance Criteria:**
- [ ] Add sortable headers for supported columns (at minimum booking date, amount, merchant, and category where data is present).
- [ ] Sort direction is visibly indicated (none/asc/desc).
- [ ] Sorting state is reflected in URL params.
- [ ] Sorting updates data deterministically without duplicated/missing rows across pages.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Add column visibility controls with session-only persistence
**Description:** As a user, I want to hide columns I do not need so that the table is easier to scan.

**Acceptance Criteria:**
- [ ] Add a column visibility menu (shadcn dropdown with checkbox items).
- [ ] Non-hideable columns remain enforced (for example row action column if required).
- [ ] Column visibility changes persist only for the active browser session and reset on a new session.
- [ ] Hidden/visible state is reflected immediately without page reload.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Migrate to shadcn/TanStack pagination and URL-synced state
**Description:** As a user, I want robust pagination controls and shareable table links so that I can resume and share exact table views.

**Acceptance Criteria:**
- [ ] Replace existing pagination controls with shadcn/TanStack-style pagination (prev/next and page-size controls; first/last optional but consistent).
- [ ] Pagination state (page index and page size) is reflected in URL params.
- [ ] URL params are parsed on load to initialize table state.
- [ ] Browser back/forward restores prior table state (filters, sorting, pagination, visibility policy as defined).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Expand API query support for server-driven table state
**Description:** As a developer, I want table controls mapped to API query params so that large transaction datasets stay performant and accurate.

**Acceptance Criteria:**
- [ ] `/api/transactions` accepts validated query params for: page, pageSize, sorting, global query, date range, account, and category.
- [ ] Invalid query values return clear 400 errors with stable error codes/messages.
- [ ] Response includes rows and pagination metadata compatible with TanStack manual/server pagination.
- [ ] Existing API tests are updated and new coverage is added for new query params and edge cases.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: The transactions list must use `@tanstack/react-table` for table state and row model orchestration.
- FR-2: The system must implement server-driven filtering/sorting/pagination for transactions data (TanStack manual mode), with UI state controlled by the table instance.
- FR-3: The system must support global text filtering for transactions via a single query input.
- FR-4: The system must support date range filtering using start and end boundaries on booking date.
- FR-5: The system must support account and category filtering from the transactions list controls.
- FR-6: The system must support sortable columns and expose the active sort key + direction in UI and URL state.
- FR-7: The system must provide a column visibility toggle menu and enforce non-hideable columns where required.
- FR-8: Column visibility preferences must persist only within the active session and must not be stored server-side.
- FR-9: The system must provide shadcn/TanStack pagination controls and page-size selection for the transactions list.
- FR-10: Table state must be URL-synced at minimum for filters, sorting, page index, and page size.
- FR-11: Loading the `/transactions` route with URL params must initialize table state from those params.
- FR-12: API query validation must reject malformed values with explicit, documented 400 responses.
- FR-13: Existing row actions (edit/delete) must remain functional and refetch the current table state after mutation.

## 5. Non-Goals (Out of Scope)

- Migrating other routes/tables (imports, monthly review, dashboard, etc.) in this phase.
- Adding row selection, bulk actions, or batch edits/deletes.
- Persisting column visibility as a long-term profile preference in database.
- Building advanced filter builders (AND/OR groups, saved filter presets).
- Reworking transaction edit/delete business rules beyond compatibility with the new table UI.

## 6. Design Considerations

- Reuse shadcn primitives already in the app (`table`, `dropdown-menu`, `button`, `input`, `select`, date inputs/popover calendar as available).
- Keep pagination and summary text outside the table grid area to match current route conventions.
- Ensure filter controls remain usable on smaller screens (wrap/stack controls and preserve table horizontal scrolling).
- Preserve current transaction row affordances (notes icon tooltip, action menu, category badge, NOK amount formatting).

## 7. Technical Considerations

- Recommended implementation mode: server-driven table behavior for production datasets, with TanStack table state on the client and API query parameters as source of truth.
- Extend `GET /api/transactions` and `src/lib/transactions/list.ts` to accept and apply new filter/sort parameters safely.
- Keep deterministic ordering by including a stable tiebreaker when sorting (for example secondary sort on `id`) to prevent row jitter across pages.
- Keep route-level state management in `src/app/transactions/use-transactions-manager.ts` per current route guidance.
- Preserve current error mapping patterns and typed response contracts used by existing transactions APIs/tests.

## 8. Success Metrics

- Users can apply at least one filter + one sort and land on the same view after page refresh via URL params.
- Users can share a `/transactions` URL and another user/session sees the same filtered/sorted page state (except session-only column visibility).
- Median interaction time for common controls (sort toggle, filter change, page change) remains subjectively instant for normal dataset sizes, with no visible duplicate/missing row artifacts.
- No regressions in transaction edit/delete interactions after table migration.

## 9. Open Questions

- Which fields should global text filter search by default (merchant only vs merchant + note + category + payment type)?
- Should date range boundaries be inclusive on both ends, and should timezone be interpreted as local app timezone or UTC date-only?
- Should account/category filter values also be encoded in URL as ids only, or include human-readable labels for debugging?
- Do we want to include first/last pagination buttons from day one, or keep only previous/next + page size for MVP?

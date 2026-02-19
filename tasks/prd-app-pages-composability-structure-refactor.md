# PRD: App Pages Composability and Structure Refactor

## 1. Introduction/Overview
Several route-level UI containers under `src/app/**` are too large to reason about safely, with multiple files between ~700 and ~1700 LOC. This PRD defines a route-by-route decomposition plan that keeps current behavior intact while splitting state, data-loading, mutation logic, and presentation into composable modules.

## 2. Goals
- Reduce cognitive load and merge risk by splitting large page managers into focused modules.
- Enforce predictable route structure across all app pages.
- Keep behavior and API contracts unchanged during refactor.
- Add targeted tests around extracted logic to prevent regressions.
- Establish size boundaries to prevent future 1k+ LOC UI files.

## 3. Current State Audit (App Pages)
- `src/app/page.tsx`: thin shell, delegates to `OverviewDashboard`.
- `src/app/overview/page.tsx`: redirect-only.
- `src/app/accounts/page.tsx` -> `src/app/accounts/accounts-manager.tsx` (~395 LOC).
- `src/app/categories/page.tsx` -> `src/app/categories/categories-manager.tsx` (~708 LOC).
- `src/app/transactions/page.tsx` -> `src/app/transactions/transactions-manager.tsx` (~870 LOC).
- `src/app/import/page.tsx` -> `src/app/import/import-uploader.tsx` (~1110 LOC) + `src/app/import/import-review-table.tsx` (~288 LOC).
- `src/app/import-provider-mappings/page.tsx` -> `src/app/import-provider-mappings/provider-mappings-manager.tsx` (~1693 LOC).
- `src/app/layout.tsx`: app shell, already small.

## 4. User Stories

### US-001: Standardize Route Composition Pattern
**Description:** As a developer, I want each page route to follow the same structure so I can quickly find data logic, UI sections, and shared types.

**Acceptance Criteria:**
- [ ] Each route with interactive UI has a route folder structure with `components/`, `hooks/`, and `types.ts` (or route-scoped equivalent).
- [ ] `page.tsx` files remain thin wrappers (layout + single feature entry component).
- [ ] No single client component exceeds 350 LOC after split.
- [ ] `pnpm lint` passes.

### US-002: Decompose Overview Dashboard
**Description:** As a developer, I want dashboard filters/fetching/chart rendering split so chart work does not require editing one large component.

**Acceptance Criteria:**
- [ ] Extract dashboard query/filter state and loading behavior into `useOverviewDashboard` hook.
- [ ] Extract chart cards into route components (`NetCashflowCard`, `InflowOutflowCard`, `AccountTrendCard`, `CategoryBreakdownCard`).
- [ ] Move date and currency formatting helpers to route utilities.
- [ ] Existing filter behavior and API calls remain unchanged.
- [ ] `pnpm lint` passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Decompose Import Page Flow
**Description:** As a developer, I want upload, provider selection, parse diagnostics, and review submission split into focused modules.

**Acceptance Criteria:**
- [ ] Extract import workflow state/transitions from `import-uploader.tsx` into a dedicated hook or reducer.
- [ ] Extract upload phase UI into an `ImportUploadPanel` component.
- [ ] Extract review phase UI into an `ImportReviewPanel` component.
- [ ] Extract provider selection dialog into `ProviderSelectionDialog`.
- [ ] Keep staging/submit behavior and diagnostics unchanged.
- [ ] `pnpm lint` passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Decompose Transactions Page
**Description:** As a developer, I want list/pagination, edit dialog, and delete confirmation isolated so changes stay local.

**Acceptance Criteria:**
- [ ] Extract data-loading and mutation handlers to `useTransactionsManager`.
- [ ] Extract table + pager into `TransactionsTableSection`.
- [ ] Extract edit form dialog into `EditTransactionDialog`.
- [ ] Extract delete confirmation into `DeleteTransactionDialog`.
- [ ] Existing paging/filter/edit/delete behavior remains unchanged.
- [ ] `pnpm lint` passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Decompose Categories Page
**Description:** As a developer, I want category CRUD and rule CRUD separated to reduce coupling.

**Acceptance Criteria:**
- [ ] Extract category CRUD form + table to `CategoryManagementSection`.
- [ ] Extract rule CRUD form + table to `CategoryRulesSection`.
- [ ] Extract shared mutation error mapping and scope helpers into route utilities.
- [ ] Existing create/delete flows and messaging remain unchanged.
- [ ] `pnpm lint` passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Decompose Provider Mappings Page
**Description:** As a developer, I want provider-mapping dialogs, form state, and field-mapping editor split so this route is maintainable.

**Acceptance Criteria:**
- [ ] Extract normalization parsing/validation/payload helpers into route utility module.
- [ ] Extract reusable field-mapping editor section used by both add/edit dialogs.
- [ ] Extract add/edit dialog containers into separate components with shared form model.
- [ ] Extract mappings table/actions into `ProviderMappingsTable`.
- [ ] Keep required-field validation and API payload semantics unchanged.
- [ ] `pnpm lint` passes.
- [ ] Verify in browser using dev-browser skill.

### US-007: Decompose Accounts Page
**Description:** As a developer, I want account form and editable table separated so account actions are easier to maintain.

**Acceptance Criteria:**
- [ ] Extract account data/mutation logic into `useAccountsManager`.
- [ ] Extract create account form into `CreateAccountSection`.
- [ ] Extract inline-edit table into `AccountsTableSection`.
- [ ] Existing create/edit/delete behavior remains unchanged.
- [ ] `pnpm lint` passes.
- [ ] Verify in browser using dev-browser skill.

### US-008: Improve Import Review Table Composability
**Description:** As a developer, I want row-level rendering logic isolated so review-table behavior can be tested independently.

**Acceptance Criteria:**
- [ ] Extract message-source resolution and row rendering helpers into route-local utilities.
- [ ] Split row cell controls into small presentational components (`MessageCell`, `CategoryCell`, `WarningCell`).
- [ ] Keep accessible labels and current row interaction semantics unchanged.
- [ ] `pnpm lint` passes.
- [ ] Verify in browser using dev-browser skill.

## 5. Functional Requirements
1. FR-1: Keep all existing routes and API endpoints unchanged while refactoring structure.
2. FR-2: Route entry `page.tsx` files must remain thin and primarily delegate to route feature components.
3. FR-3: Large route managers must split into route-scoped `components`, `hooks`, and `utils` modules.
4. FR-4: Shared UI logic duplicated between add/edit flows (especially provider mappings) must be centralized.
5. FR-5: Data-fetching and mutation functions must be moved out of large JSX files into hooks/service-like route modules.
6. FR-6: Formatting and parser/helper functions currently embedded in large components must be moved to utility modules.
7. FR-7: Each extracted hook/component must have clear responsibilities and typed props/contracts.
8. FR-8: Existing user-visible strings, success/error states, and interaction semantics must remain stable unless explicitly improved in follow-up PRDs.
9. FR-9: Add targeted tests for extracted pure logic and behavior-critical hooks/components where currently untested.
10. FR-10: Enforce structural guardrails in review checklist: no new single route component >350 LOC without explicit exception.

## 6. Non-Goals (Out of Scope)
- Redesigning visual UI/UX.
- Changing API payloads, endpoints, or database schema.
- Rewriting business rules for import parsing, dedupe, categorization, or analytics.
- Converting to a global state library.
- Broad cross-app refactors outside `src/app/**` page composition needs.

## 7. Design Considerations
- Preserve current layout conventions: route headings, separators, and table primitives.
- Keep route section boundaries visible in component names (`*Section`, `*Dialog`, `*Table`).
- Prefer one responsibility per component: data loading, form state, table display, or modal interaction.

## 8. Technical Considerations
- Follow existing conventions in `AGENTS.md`:
  - Keep route logic client-side where currently expected.
  - Maintain import/review staged workflow behavior.
  - Keep table rendering on shadcn primitives.
- Use route-local modules first; promote to shared `src/components` only when reused by multiple routes.
- Extract pure logic first (formatting/validation/mapping), then extract UI shells, then hooks.
- Preserve existing Playwright locator compatibility (especially select trigger labels in import review flows).

## 9. Delivery Plan (Phased)
1. Phase 1: `overview` + `accounts` decomposition (lowest risk baseline).
2. Phase 2: `categories` + `transactions` decomposition.
3. Phase 3: `import` decomposition (upload/review/provider dialog split).
4. Phase 4: `import-provider-mappings` decomposition (largest module; shared editor extraction first).
5. Phase 5: Cleanup pass for route docs, test gaps, and LOC threshold validation.

## 10. Success Metrics
- Largest route component reduced from ~1693 LOC to <=350 LOC.
- No route has a single component handling fetching + multiple forms + dialogs + table rendering all in one file.
- Reduced median PR diff size for page-level changes (target: <250 LOC touched per feature tweak).
- Fewer regression fixes caused by incidental edits in unrelated route concerns.

## 11. Open Questions
- Should we enforce the LOC boundary via CI (custom script) or keep it as review policy only?
- Do we want a shared `useApiRequest` helper now, or keep hooks route-local until duplication grows?
- For provider mappings, should add/edit dialogs share a single `ProviderMappingFormDialog` immediately or in a follow-up to reduce refactor risk?

# PRD: Server Actions Refactor (Mutations First)

## 1. Introduction/Overview

This refactor replaces selected client-side fetch calls to internal API routes with Next.js Server Actions, starting with low-risk mutation workflows. The goal is to reduce client-side complexity and improve maintainability while preserving current behavior and UI. The first pass is intentionally limited to mutation flows only (create/update/delete and save operations), with no visual redesign.

## 2. Goals

- Reduce client-side data-mutation orchestration in feature modules by moving targeted writes to Server Actions.
- Keep user-facing behavior functionally equivalent for all migrated workflows (input validation, success/failure messaging, and persisted data).
- Establish one reusable migration pattern for Server Actions (validation, auth checks, error shape, revalidation strategy).
- Complete migration in low-risk areas first to de-risk broader adoption.

## 3. User Stories

### US-001: Define Server Action architecture and guardrails
**Description:** As a developer, I want a standard Server Action pattern so that every migrated mutation is consistent and easy to maintain.

**Acceptance Criteria:**
- [ ] A documented action pattern exists for input validation, authorization, typed success/error response, and cache revalidation.
- [ ] At least one shared helper (or equivalent convention) is used by multiple actions to prevent duplication.
- [ ] Existing API route behavior is mapped to equivalent action behavior before migration starts.
- [ ] Typecheck/lint passes.

### US-002: Migrate low-risk settings mutation workflow
**Description:** As a user, I want settings updates to save as before so that my workflow is unchanged while implementation moves server-side.

**Acceptance Criteria:**
- [ ] One low-risk settings mutation flow (for example, message cleanup settings or monthly-review system prompt save) is migrated to a Server Action.
- [ ] Save success and failure behavior matches current UX copy and interaction pattern.
- [ ] No new user-visible fields, controls, or layout changes are introduced.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Migrate low-risk entity management mutation workflow
**Description:** As a user, I want create/update operations in one low-risk entity area to continue working reliably after migration.

**Acceptance Criteria:**
- [ ] One entity mutation flow (for example, provider mappings, categories, or category rules) is moved from client-side API fetch to Server Action.
- [ ] Validation and error handling produce equivalent outcomes to current implementation.
- [ ] Data is persisted correctly and visible after refresh/navigation.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Implement parity-focused regression coverage for migrated mutations
**Description:** As a developer, I want confidence checks around migrated flows so that refactoring does not introduce behavior regressions.

**Acceptance Criteria:**
- [ ] Tests are added or updated for migrated mutation flows at the most appropriate layer (unit/integration/e2e based on existing project conventions).
- [ ] Happy-path and at least one failure-path per migrated workflow are covered.
- [ ] Existing related tests continue to pass without weakening assertions.
- [ ] Typecheck/lint passes.

### US-005: Remove obsolete client mutation fetch logic for migrated flows
**Description:** As a developer, I want old mutation fetch plumbing removed so that the codebase is simpler and less error-prone.

**Acceptance Criteria:**
- [ ] For migrated workflows, direct client calls to `/api/...` mutation endpoints are removed or no longer used.
- [ ] Dead code introduced by migration is removed (unused hooks/helpers/state branches).
- [ ] Migrations are scoped to selected low-risk flows only; unrelated workflows are untouched.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

1. **FR-1:** The system must support Server Actions for selected mutation workflows currently executed via client-side `fetch` to internal `/api/*` routes.
2. **FR-2:** Each migrated action must validate input server-side and return a predictable, typed result shape for success and failure.
3. **FR-3:** Each migrated action must enforce existing authorization/access assumptions (no reduction in current security posture).
4. **FR-4:** Each migrated action must trigger cache/path revalidation (or equivalent refresh behavior) so post-mutation UI state remains accurate.
5. **FR-5:** The initial migration scope must include low-risk mutation workflows only and must exclude high-risk/complex flows.
6. **FR-6:** For every migrated workflow, user-facing behavior must remain equivalent: same core interactions, same outcome semantics, and no required retraining.
7. **FR-7:** The implementation must preserve compatibility with existing data model and schema (no Prisma schema or database model changes in this refactor).
8. **FR-8:** The codebase must remove obsolete client mutation fetch code for migrated flows to reduce duplicated pathways.

## 5. Non-Goals (Out of Scope)

- UI redesign, visual refresh, or interaction redesign.
- Prisma schema changes, database model changes, or migration scripts.
- Broad migration of read/query data fetching to Server Actions in this phase.
- Full app-wide conversion of all API route usage.
- Reworking authentication/authorization model beyond preserving existing behavior.

## 6. Design Considerations

- Maintain existing screens, component hierarchy, and visual behavior.
- Any UI touch should be wiring-only (form action hookup, pending state plumbing if already aligned with current UX).
- Prefer consistency with existing component patterns and naming conventions.

## 7. Technical Considerations

- Prioritize low-risk modules first (for example: settings saves, simple create/update forms with limited side effects).
- Keep API routes for non-migrated or high-risk workflows during transition.
- Standardize on one action error contract to simplify client handling.
- Use Next.js revalidation primitives (`revalidatePath`/`revalidateTag`) where needed for post-mutation freshness.
- Ensure server-side validation is not weaker than current route-level validation.

## 8. Success Metrics

- 100% of targeted low-risk mutation workflows are implemented using Server Actions with behavior parity.
- 0 critical regressions reported in migrated workflows during validation window.
- Reduced client mutation complexity in migrated modules (fewer direct mutation fetch calls and less mutation boilerplate).

## 9. Open Questions

- Which exact workflows are the first low-risk candidates (final list and order)?
- Should legacy API mutation routes for migrated flows be deleted immediately or kept temporarily behind compatibility boundaries?
- What is the minimum required automated test depth per migrated workflow (unit only vs integration/e2e where available)?
- In a follow-up phase, which read/query flows should be evaluated for migration and what selection criteria will be used?

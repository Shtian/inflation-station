# PRD: UI Feedback Consistency, Field Standardization, and OKLCH Category Colors

## 1. Introduction/Overview

This work standardizes three UX consistency areas in Inflation Station:

1. Replace inline success notices with shadcn Sonner toasts for action feedback (for example, `"Provider mapping removed."`).
2. Standardize form field structure on `@/components/ui/field` for consistent visual rhythm and improved accessibility semantics.
3. Migrate deterministic category colors from HSL-based profiles to OKLCH-based profiles, with this as the highest-priority change to improve perceived lightness consistency across hues.

The scope includes a discovery-first pass so the team has a clear inventory of where inline messages and non-Field form patterns exist before implementation.

## 2. Goals

- Deliver an implementation-ready inventory of feedback and form-field replacement targets before coding the UX migration.
- Standardize transient success feedback on Sonner toasts across account, category, provider mapping, import, and settings flows.
- Standardize form control grouping to use `@/components/ui/field.tsx` primitives where user-editable inputs are present.
- Migrate deterministic category colors to OKLCH-based generation while preserving determinism and WCAG-appropriate text contrast behavior.
- Keep existing route behavior and API contracts unchanged while improving consistency and accessibility.

## 3. User Stories

### US-001 (P0): Audit feedback and form-field replacement scope before migration
**Description:** As a developer, I want a precise inventory of inline feedback and non-Field form patterns so that migration work is low-risk and complete.

**Acceptance Criteria:**
- [ ] Produce a checklist of all inline success/error feedback patterns currently rendered in-page (including route/component path and message text).
- [ ] Produce a checklist of all user-input surfaces that do not use `@/components/ui/field` and classify each as in-scope or out-of-scope.
- [ ] Identify test files that assert inline message text and require updates for toast assertions.
- [ ] PRD/plan includes rollout order and risk notes for each area.
- [ ] Typecheck/lint pass after any scaffolding/docs changes.

### US-002 (P1): Add Sonner infrastructure and global toast mounting
**Description:** As a user, I want action confirmations/errors to appear as consistent toasts so that feedback is predictable across routes.

**Acceptance Criteria:**
- [ ] Add shadcn Sonner primitive(s) and mount a single global toaster in app layout.
- [ ] Define a shared toast usage pattern (success/error/info wording, optional action, duration, and placement).
- [ ] Ensure toasts remain visible and accessible in both light and dark themes.
- [ ] Existing pages continue rendering without hydration/layout regressions.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003 (P1): Replace inline success notices with Sonner toasts in CRUD/settings flows
**Description:** As a user, I want operation outcomes to be communicated consistently via toasts instead of route-specific inline success banners.

**Acceptance Criteria:**
- [ ] Replace success notice state/rendering in:
  - `src/app/import-provider-mappings/provider-mappings-manager.tsx`
  - `src/app/categories/categories-manager.tsx`
  - `src/app/accounts/use-accounts-manager.ts` and `src/app/accounts/accounts-manager.tsx`
  - `src/app/import/components/import-upload-phase.tsx`
  - `src/app/import/components/import-review-phase.tsx`
  - `src/app/import/settings/message-cleanup/message-cleanup-settings-manager.tsx`
  - `src/app/monthly-review/settings/monthly-review-settings-manager.tsx`
- [ ] Keep blocking validation/server errors inline where immediate in-context correction is required.
- [ ] Preserve current feedback copy unless explicitly updated by product/content direction.
- [ ] Update E2E assertions that currently target inline success text to target Sonner toast output.
- [ ] Typecheck/lint and relevant E2E tests pass.
- [ ] Verify in browser using dev-browser skill.

### US-004 (P1): Standardize form layouts and semantics using `@/components/ui/field`
**Description:** As a user, I want all forms to have consistent label/description/error semantics and spacing so data entry feels coherent and accessible.

**Acceptance Criteria:**
- [ ] Replace ad-hoc Label/Input groupings with `Field`, `FieldLabel`, `FieldContent`, `FieldDescription`, and `FieldError` where applicable.
- [ ] Apply migration to primary form surfaces, including:
  - `src/app/accounts/components/create-account-section.tsx`
  - `src/app/categories/components/category-management-section.tsx`
  - `src/app/categories/components/rules-management-section.tsx`
  - `src/app/import-provider-mappings/components/add-provider-mapping-dialog.tsx`
  - `src/app/import-provider-mappings/components/edit-provider-mapping-dialog.tsx`
  - `src/app/import-provider-mappings/components/provider-mapping-string-badge-input.tsx`
  - `src/app/transactions/components/edit-transaction-dialog.tsx`
  - `src/app/import/settings/message-cleanup/message-cleanup-settings-manager.tsx`
  - `src/app/monthly-review/settings/monthly-review-settings-manager.tsx`
  - `src/app/import/components/import-upload-phase.tsx` (only where field semantics apply; preserve custom dropzone behavior)
- [ ] Keep existing keyboard interactions and aria labels for complex controls (combobox/select/dialog).
- [ ] Do not regress route-local visual hierarchy or dialog-specific spacing.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005 (P0): Migrate deterministic color generation from HSL profiles to OKLCH profiles
**Description:** As a user, I want category colors to have consistent perceived lightness across hues so labels and charts are easier to scan.

**Acceptance Criteria:**
- [ ] Refactor `src/lib/deterministic-color.ts` to generate background/border colors using OKLCH profiles (not HSL).
- [ ] Keep deterministic mapping by preserving hash-to-hue behavior (or equivalent deterministic hue index strategy).
- [ ] Preserve or improve contrast guarantees for generated text colors in light and dark themes.
- [ ] Update and expand tests in `src/lib/deterministic-color.test.ts` and `src/lib/category-color.test.ts` to validate new color format and contrast assumptions.
- [ ] Validate no regressions in components consuming color outputs, including `src/components/category-badge.tsx` and overview/monthly-review visualizations.
- [ ] Typecheck/lint and unit tests pass.

## 4. Functional Requirements

- FR-1: The system must provide a pre-implementation inventory of inline feedback and form standardization targets.
- FR-2: A single global Sonner toaster must be mounted in the root app shell and available to all client routes.
- FR-3: Success outcomes for CRUD/settings operations currently shown as inline banners must be emitted as Sonner toasts.
- FR-4: Inline error messaging for actionable validation failures must remain close to the input/control that requires correction.
- FR-5: Form controls must use `@/components/ui/field` primitives for label/content/description/error structure unless the control pattern is not supported by Field.
- FR-6: Where Field is not directly applicable (for example file-dropzone container), controls must still align to Field semantics for label and error association.
- FR-7: Deterministic color generation must produce OKLCH-based CSS color strings for background and border outputs.
- FR-8: Deterministic color outputs must remain stable for identical normalized input text.
- FR-9: Generated foreground/background combinations must continue meeting the current contrast threshold expectations used by tests.
- FR-10: Existing API endpoints, payload contracts, and mutation orchestration must remain unchanged.
- FR-11: Existing high-value E2E flows that assert success feedback must be updated to validate toast-based behavior.

## 5. Non-Goals (Out of Scope)

- Rewriting all error presentation to toasts (errors that require contextual correction remain inline).
- Broad redesign of route layouts, typography, or card structure beyond feedback/form standardization.
- Changing business rules for account/category/provider/import/monthly-review mutations.
- Introducing non-deterministic or user-customizable category palettes in this phase.
- Migrating unrelated visualization color systems outside deterministic category color consumers.

## 6. Design Considerations

- Use shadcn Sonner patterns for a consistent interaction model and theme integration.
- Keep toast copy concise and action-oriented; avoid duplicate simultaneous inline success banners.
- Apply Field primitives without flattening route-specific UX (dialogs, tables, and wizard-like import flow should keep their structure).
- Preserve existing semantics where they are already strongly accessible (for example combobox aria labels and dialog focus behavior).

## 7. Technical Considerations

- Add/confirm Sonner dependency and a shared toaster component under `src/components/ui` according to shadcn conventions.
- Mount toaster in `src/app/layout.tsx` so all route-level managers can call toast helpers.
- Migrate incrementally by route to reduce regression risk and keep diffs reviewable.
- Update tests that currently depend on inline success text visibility (for example:
  - `tests/e2e/us-011-account-import-ui.e2e.ts`
  - `tests/e2e/us-015-categories-route-management.e2e.ts`
  - `tests/e2e/us-019-provider-mapping-admin-ui.e2e.ts`
  - `tests/e2e/us-020-monthly-review-route.e2e.ts`).
- For OKLCH migration, ensure runtime/browser support assumptions are compatible with current Next.js target and testing environment.
- Keep color-output API stable where possible to minimize downstream churn (`backgroundColor`, `borderColor`, `lightTextColor`, `darkTextColor`, contrast ratios).

## 8. Success Metrics

- 100% of in-scope success feedback surfaces use Sonner toasts and no longer render duplicate inline success banners.
- 100% of in-scope form input groups use `@/components/ui/field` or documented equivalent semantics for unsupported patterns.
- Deterministic color tests pass with OKLCH output and maintain required contrast thresholds.
- No regressions in core E2E flows for account/category/provider-mapping/settings actions.
- Visual QA confirms consistent feedback behavior and form spacing across desktop and mobile.

## 9. Rollout Plan (Recommended)

1. Implement US-005 (OKLCH color migration) first due to highest priority.
2. Complete US-001 audit artifacts and lock migration checklist.
3. Add Sonner infrastructure (US-002).
4. Migrate inline success feedback to toasts route-by-route (US-003) with corresponding E2E updates.
5. Migrate forms to Field primitives in small batches (US-004), validating accessibility and layout after each route.

## 10. Open Questions

- Should all non-blocking errors also move to toasts, or should only success/info move while errors stay inline by default?
- Should toast duration be standardized globally (single duration) or vary by message type?
- For OKLCH profiles, do we want to preserve current visual intent of `vibrant`, `muted`, and `mattePastel` names exactly, or allow slight retuning to optimize perceptual consistency?
- Do we want a small shared helper wrapper around Sonner (`notifySuccess`, `notifyError`) to enforce copy/style consistency?

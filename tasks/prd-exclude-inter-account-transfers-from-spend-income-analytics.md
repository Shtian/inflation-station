# PRD: Exclude Inter-Account Transfers From Spend/Income Analytics

## 1. Introduction/Overview

Users transfer money between their own accounts (for example, savings to checking). These are internal balance movements, not real income or spending.

Today, transfer-like transactions can appear in Overview and Monthly Review spend/income analytics, which inflates totals and reduces trust in the numbers. This feature ensures transactions categorized as `Category.kind = TRANSFER` are excluded from spend/income analytics while remaining visible in the transaction ledger.

## 2. Goals

- Exclude transfer-category transactions from spend/income analytics in all in-scope surfaces.
- Keep transfer transactions visible and editable in transaction list/detail workflows.
- Ensure Overview and Monthly Review metrics are consistent with each other.
- Add clear inline UI messaging that transfer-category transactions are excluded from spend/income analytics.
- Preserve deterministic, testable behavior.

## 3. User Stories

### US-001: Exclude transfer-category rows from Overview analytics
**Description:** As a user, I want transactions categorized as `TRANSFER` to be excluded from Overview spend/income charts so analytics reflects real spending and earning.

**Acceptance Criteria:**
- [ ] Overview net cashflow excludes rows where `category.kind = TRANSFER`
- [ ] Overview inflow/outflow excludes rows where `category.kind = TRANSFER`
- [ ] Overview category spend breakdown excludes rows where `category.kind = TRANSFER`
- [ ] Uncategorized rows remain included
- [ ] Typecheck/lint passes

### US-002: Exclude transfer-category rows from Monthly Review overview/timeline metrics
**Description:** As a user, I want Monthly Review totals and deltas to ignore transfer-category transactions so month summaries are not inflated.

**Acceptance Criteria:**
- [ ] Monthly total spend excludes rows where `category.kind = TRANSFER`
- [ ] Monthly spend transaction count excludes rows where `category.kind = TRANSFER`
- [ ] Monthly category spend breakdown excludes rows where `category.kind = TRANSFER`
- [ ] Month-over-month spend delta uses transfer-excluded spend totals
- [ ] Uncategorized rows remain included
- [ ] Typecheck/lint passes

### US-003: Exclude transfer-category rows from Monthly Review generation input metrics
**Description:** As a user, I want Monthly Review AI analysis metrics to ignore transfer-category transactions so generated insights describe actual spending patterns.

**Acceptance Criteria:**
- [ ] `metrics.monthlyTotals.totalSpendNok` excludes rows where `category.kind = TRANSFER`
- [ ] `metrics.categoryTotals` excludes rows where `category.kind = TRANSFER`
- [ ] `metrics.merchantConcentration` excludes rows where `category.kind = TRANSFER`
- [ ] `metrics.monthOverMonth` uses transfer-excluded totals
- [ ] Uncategorized rows remain included
- [ ] Typecheck/lint passes

### US-004: Add inline UI messaging about transfer exclusion
**Description:** As a user, I want clear inline messaging so I understand why spend/income analytics may differ from raw account movement totals.

**Acceptance Criteria:**
- [ ] Overview page includes inline copy explaining transfer-category exclusion from spend/income analytics
- [ ] Monthly Review page includes equivalent inline copy
- [ ] Copy is visible in normal page flow (not hover-only)
- [ ] Copy is concise, consistent, and non-technical
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Add automated coverage for transfer exclusion behavior
**Description:** As a developer, I want regression tests for transfer exclusion so future changes do not reintroduce inflated analytics totals.

**Acceptance Criteria:**
- [ ] Add/update tests in `src/lib/dashboard/analytics.test.ts`
- [ ] Add/update tests in `src/lib/monthly-review/overview.test.ts`
- [ ] Add/update tests in `src/lib/monthly-review/generation-input.test.ts`
- [ ] Tests cover: transfer excluded, non-transfer included, uncategorized included
- [ ] Relevant test suite passes

## 4. Functional Requirements

- FR-1: The exclusion trigger is `Category.kind = TRANSFER` only.
- FR-2: Overview net cashflow must exclude transfer-category transactions.
- FR-3: Overview inflow/outflow must exclude transfer-category transactions.
- FR-4: Overview category spend breakdown must exclude transfer-category transactions.
- FR-5: Monthly Review overview/timeline monthly spend totals must exclude transfer-category transactions.
- FR-6: Monthly Review overview/timeline spend transaction counts must exclude transfer-category transactions.
- FR-7: Monthly Review overview/timeline category spend breakdown must exclude transfer-category transactions.
- FR-8: Monthly Review overview/timeline month-over-month spend delta must be computed from transfer-excluded totals.
- FR-9: Monthly Review generation-input metrics (monthly totals, category totals, merchant concentration, month-over-month metrics) must exclude transfer-category transactions.
- FR-10: Uncategorized transactions remain included until explicitly categorized as `TRANSFER`.
- FR-11: API response shapes remain backward compatible unless explicitly documented otherwise.
- FR-12: Overview and Monthly Review pages must display inline explanatory copy about transfer exclusion.

## 5. Non-Goals (Out of Scope)

- No exclusion based on `paymentType = TRANSFER` alone.
- No transfer auto-detection enhancements beyond existing category/rule workflows.
- No explicit "Internal Transfers" reporting metric in this phase.
- No transfer matching/reconciliation across account pairs.
- No changes to transaction dedupe logic.
- No hiding/deleting transfer transactions from transaction pages.

## 6. Design Considerations

- Add inline explanatory text on:
  - Overview route
  - Monthly Review route
- Suggested copy: "Transactions categorized as Transfer are excluded from spend/income analytics."
- Keep copy minimal and consistent across both routes.
- Reuse existing typography and spacing patterns from each page.

## 7. Technical Considerations

- Include `category.kind` in relevant analytics query selections.
- Apply a deterministic predicate in each aggregation pipeline:
  - Include transaction in spend/income analytics only when `category.kind !== TRANSFER` (or category is `null`).
- Update logic in:
  - `src/lib/dashboard/analytics.ts`
  - `src/lib/monthly-review/overview.ts`
  - `src/lib/monthly-review/generation-input.ts`
- Keep route handlers thin and response contracts stable.
- Add focused unit tests only for changed behavior.

## 8. Success Metrics

- Correctness: seeded and test fixtures with transfer rows show expected transfer-excluded totals across all in-scope analytics surfaces.
- Consistency: Overview and Monthly Review spend metrics align for the same underlying data.
- Reliability: unit tests prevent regressions in transfer exclusion behavior.
- UX clarity: users see inline explanation of exclusion on both Overview and Monthly Review pages.

## 9. Open Questions

- None for this phase.

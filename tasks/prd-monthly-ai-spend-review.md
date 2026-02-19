# PRD: Monthly AI Spend Review

## 1. Introduction/Overview

Add a monthly spend review feature that lets the user trigger an AI review for any completed month from a timeline page. Each month should always show a brief deterministic overview (even if no AI review has been generated). AI review generation is manual in V1 and should use a configurable system prompt for baseline context. The system should pass each transaction at minimum, while preferring precomputed aggregates and derived metrics so the model does less math.

## 2. Goals

- Provide a month-by-month timeline view of spending history with deterministic summaries.
- Allow the user to manually trigger AI review generation for any month.
- Support a configurable system prompt used for every generation.
- Minimize LLM math by precomputing totals, deltas, and category-level breakdowns before AI invocation.
- Keep generation behavior deterministic and safe by requiring confirmation before every generation.
- Replace existing review output when regeneration is confirmed.

## 3. User Stories

### US-001: View monthly timeline with baseline overview
**Description:** As the app owner, I want to see a timeline of months with baseline spend summaries so I can scan financial history without generating AI reviews.

**Acceptance Criteria:**
- [ ] Timeline lists months with transaction activity in descending chronological order.
- [ ] Each month shows deterministic overview fields (at minimum: total spend, transaction count, top category, and month-over-month delta when prior month exists).
- [ ] Months without AI review still show the deterministic overview.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Trigger manual AI review for a month
**Description:** As the app owner, I want to trigger AI review for a selected month so I can get narrative insights on demand.

**Acceptance Criteria:**
- [ ] Each month has a visible `Generate review` action when generation is available.
- [ ] Triggering generation sends the selected month context and required payload to backend review API.
- [ ] UI shows pending/loading state and success/error feedback for the selected month.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Confirm before every generation
**Description:** As the app owner, I want a confirmation prompt before generating or regenerating so I avoid accidental runs.

**Acceptance Criteria:**
- [ ] Clicking generation action always opens a confirmation dialog before request submission.
- [ ] Confirmation copy distinguishes first-time generation vs replacement of existing review.
- [ ] Generation request is not sent if user cancels.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Replace existing month review on regenerate
**Description:** As the app owner, I want regeneration to replace existing review output so only one current review exists per month.

**Acceptance Criteria:**
- [ ] If a month already has a review, confirmed generation replaces the stored review content for that month.
- [ ] Timeline reflects updated `last generated` metadata after replacement.
- [ ] API response and persistence semantics are explicit about replacement behavior.
- [ ] Typecheck/lint passes.

### US-005: Configure system prompt for monthly reviews
**Description:** As the app owner, I want to manage a reusable system prompt so AI reviews follow stable instructions and context.

**Acceptance Criteria:**
- [ ] App provides a settings input for monthly review system prompt text.
- [ ] Saved system prompt is retrieved and used for future monthly review generations.
- [ ] Empty or missing prompt falls back to a safe default prompt.
- [ ] Prompt updates do not retroactively change already stored review output.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Precompute monthly analytics before AI call
**Description:** As the app owner, I want the system to precompute calculations so the AI receives reliable numeric context.

**Acceptance Criteria:**
- [ ] Backend computes and includes month totals, category totals, merchant concentration indicators, and month-over-month deltas when prior data exists.
- [ ] AI request includes precomputed values and avoids asking model to perform core arithmetic.
- [ ] Computed metrics are consistent with deterministic monthly overview values shown in UI.
- [ ] Typecheck/lint passes.

### US-007: Send minimal necessary transaction data
**Description:** As the app owner, I want each transaction represented with only needed fields so AI cost and noise are reduced.

**Acceptance Criteria:**
- [ ] AI request includes at least one record per transaction for the month.
- [ ] Per-transaction payload is limited to required fields (for example: booking date, amount NOK, normalized merchant, payment type, category label, note/message when available and relevant).
- [ ] Sensitive or unused fields are excluded from AI payload.
- [ ] Typecheck/lint passes.

### US-008: Display review result and no-review state in timeline
**Description:** As the app owner, I want each month card to clearly show whether a review exists and the latest output so I can navigate history quickly.

**Acceptance Criteria:**
- [ ] Month with no generated review shows explicit empty state text.
- [ ] Month with generated review shows concise insight preview and metadata (generated timestamp).
- [ ] Expanded view or detail area exposes full stored review for that month.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 4. Functional Requirements

- FR-1: The system must provide a monthly timeline page showing deterministic overview data for each month independent of AI review status.
- FR-2: The system must allow manual review generation for a selected month.
- FR-3: The system must require an explicit user confirmation prompt before every generation action.
- FR-4: The system must replace existing review content for the month when regeneration is confirmed.
- FR-5: The system must persist and use a configurable system prompt for monthly review generation.
- FR-6: The system must compute required analytics (totals/deltas/breakdowns) before invoking AI.
- FR-7: The system must include each transaction in the AI input with a minimal-field payload.
- FR-8: The system must handle missing `OPENAI_API_KEY` or provider failures without breaking deterministic monthly overview rendering.
- FR-9: The timeline UI must expose review state per month: not generated, generating, generated, failed.
- FR-10: The system must record generation metadata (month, generated timestamp, prompt version or prompt snapshot identifier, and status) for traceability.

## 5. Non-Goals (Out of Scope)

- Automatic scheduled generation at month rollover.
- Multi-user permissions or role-based access.
- Editable AI-produced category changes applied directly to transactions.
- Chat-style follow-up conversation over a monthly review.
- Cross-month long-horizon forecasting or budgeting recommendations.
- External exports (PDF/email/slack) of review output.

## 6. Design Considerations

- Add a dedicated route (for example `/monthly-review`) with timeline-first layout.
- Keep timeline cards compact, with deterministic summary always visible and AI section as a stateful subpanel.
- Use consistent confirmation modal pattern used elsewhere in the app for destructive/expensive actions.
- Show generation states clearly with explicit labels instead of icon-only indicators.

### Mockup Alignment (Image #1)

- Layout should follow the provided timeline mockup: summary stat row at top, then month cards connected by a vertical timeline line with circular month nodes.
- Month header should include month/year, tracked-categories count, amount, and month-over-month trend indicator.
- The most recent month should render a `Current` tag using shadcn `Badge`.
- Budget visualization should use custom elements: nested-`div` usage progress bar with percentage widths, plus stacked spending-category bar with proportional segment widths and category legend values.
- AI review state should include a shadcn `Button` for `Get AI Review` when no review exists.
- AI review display should use a custom insight panel (`border-primary/20 bg-primary/5`) when review exists.
- Regeneration in the insight panel should use a plain HTML `button` for `Regenerate insight`.
- Icons should use `lucide-react` (`DollarSign`, `TrendingDown`, `TrendingUp`, `Calendar`, `ArrowDownRight`, `ArrowUpRight`, `Sparkles`, `Loader2`, `Check`).
- Outside of `Badge` and `Button`, UI primitives are custom Tailwind-based components for this route.

## 7. Technical Considerations

- Reuse existing dashboard analytics conventions for deterministic monthly aggregates where possible.
- Keep API route handlers thin; move monthly review query/generation orchestration into `src/lib/*` modules following repository conventions.
- Keep OpenAI integration optional and best-effort as with existing AI-related flows.
- Define a stable internal payload contract for monthly AI calls so prompt iteration does not require broad refactors.
- Persist one current review per month (replace semantics), while still tracking generation timestamp and execution status.
- Ensure deterministic normalization for merchant/payment fields is reused from existing import normalization conventions.
- For route UI implementation, use shadcn components only where specified (`Badge`, `Button`) and implement timeline/stat/budget/insight layout primitives with route-local Tailwind components.

## 8. Success Metrics

- 100% of months with transactions render deterministic summaries without requiring AI.
- User can trigger or regenerate a month review in <= 2 interactions after opening a month card (action + confirmation).
- Regeneration replaces existing review output consistently with no duplicate month-review records.
- AI payload token size is reduced versus raw transaction dumps by relying on precomputed aggregates and minimal per-transaction fields.
- Generation failures do not block page loading or deterministic monthly overview visibility.

## 9. Open Questions

- Should month timeline include empty months (no transactions) for continuity, or only months with activity?
- What is the default system prompt content for V1, and should it be versioned explicitly?
- Should the UI show how many tokens/estimated cost each generation used?
- Should failed generations be retryable from the same month card with retained error reason?
- Should month summaries support account filters in V1 or always aggregate across all accounts?

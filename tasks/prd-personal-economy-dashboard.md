# PRD: Personal Economy Dashboard (Local Next.js App)

## 1. Introduction/Overview

Build a local-first web app in the existing Next.js + Tailwind project that imports bank transaction CSV files and provides a clear overview of personal economy across four bank accounts in Norwegian Kroner (NOK). The app must deduplicate overlapping uploads, categorize transactions, and let the user manually review categories before finalizing. Optional OpenAI-powered category suggestions should be supported, but the app must work without OpenAI.

The app runs locally only (no auth) and must be practical on macOS and Raspberry Pi Linux.

## 2. Goals

- Provide unified visibility into inflow, outflow, and net cashflow across 4 monitored bank accounts.
- Import semicolon-delimited CSV files with mixed Norwegian/English values and normalize data consistently.
- Prevent duplicate transactions when users upload overlapping history periods.
- Provide category assignment pipeline: rule-based baseline + optional OpenAI suggestions + mandatory manual review before submit.
- Deliver useful visual analytics (cashflow and account state over time) with responsive UI built with shadcn components.
- Keep setup simple for local use with SQLite + Prisma.

## 3. User Stories

### US-001: Configure and manage monitored accounts
**Description:** As a user, I want four default account slots and the ability to rename/add/remove accounts so I can match the app to my real accounts.

**Acceptance Criteria:**
- [ ] First app start includes four default account records.
- [ ] User can rename each default account.
- [ ] User can add or remove accounts later.
- [ ] Account list persists in local database.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using Playwright CLI.

### US-002: Upload CSV files per account
**Description:** As a user, I want to upload one or more CSV files for a selected account so I can import my transaction history.

**Acceptance Criteria:**
- [ ] Upload form requires selecting an account before import.
- [ ] Parser supports `;` as delimiter and headers like `Bokføringsdato`, `Beløp`, `Avsender`, `Mottaker`, `Navn`, `Tittel`, `Valuta`, `Betalingstype`.
- [ ] Amount parsing supports Norwegian decimal format (comma decimals, possible minus sign).
- [ ] Currency is stored as NOK and non-NOK rows are rejected with visible error.
- [ ] Import summary shows rows imported, duplicates skipped, rows ignored.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using Playwright CLI.

### US-003: Ignore reserved/pending rows
**Description:** As a user, I want reserved (`Reservert`) rows excluded so analytics only use posted transactions.

**Acceptance Criteria:**
- [ ] Rows with booking date value `Reservert` are not imported as transactions.
- [ ] Import summary reports count of ignored reserved rows.
- [ ] Reserved-row handling is deterministic and covered by parser tests.
- [ ] Typecheck/lint passes.

### US-004: Deduplicate overlapping history imports
**Description:** As a user, I want duplicate rows ignored when importing overlapping date ranges so totals remain accurate.

**Acceptance Criteria:**
- [ ] Duplicate detection is applied across all uploads for the same account.
- [ ] Deduplication uses deterministic fingerprint fields (at minimum: account id, booking date, amount, normalized counterpart/merchant text, payment type).
- [ ] Duplicate rows are skipped, not reinserted.
- [ ] Import summary reports duplicates skipped.
- [ ] Typecheck/lint passes.

### US-005: Auto-categorize with rules and optional OpenAI suggestions
**Description:** As a user, I want automatic category suggestions so manual work is reduced.

**Acceptance Criteria:**
- [ ] Rule-based categorization runs for all newly imported uncategorized rows.
- [ ] If OpenAI API key is configured, app can request category suggestions for unresolved rows.
- [ ] If OpenAI is unavailable or disabled, app continues with rule-based flow only.
- [ ] Suggestions include confidence score or reason text.
- [ ] Typecheck/lint passes.

### US-006: Review and approve categories before submit
**Description:** As a user, I want to manually review suggested categories before finalizing so data quality stays high.

**Acceptance Criteria:**
- [ ] Review screen lists uncategorized/suggested rows with editable category field.
- [ ] User can bulk-accept suggestions and edit individual rows.
- [ ] Final submit writes approved categories to transactions.
- [ ] Unsubmitted review changes are not applied permanently.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using Playwright CLI.

### US-007: Visualize cashflow and account state
**Description:** As a user, I want clear graphs so I can understand spending patterns and account trends.

**Acceptance Criteria:**
- [ ] Dashboard shows date-range filters (e.g., 30d, 90d, year-to-date, custom).
- [ ] Dashboard includes: net cashflow over time, inflow vs outflow over time, category spend breakdown, and account balance/state trend.
- [ ] Graphs update by selected account(s) and date range.
- [ ] Values are formatted in NOK consistently.
- [ ] UI uses shadcn components for controls/cards/tables.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using Playwright CLI.

### US-008: Local deployment on macOS and Raspberry Pi Linux
**Description:** As a user, I want simple local setup so I can run the app on my machines without cloud dependencies.

**Acceptance Criteria:**
- [ ] README includes setup steps for macOS and Raspberry Pi Linux.
- [ ] Database initialization and migration steps are documented.
- [ ] App runs in development and production local modes.
- [ ] No authentication required.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: The system must provide account management with four default accounts at initial setup.
- FR-2: The system must allow CSV upload mapped to a selected account.
- FR-3: CSV parser must support semicolon-separated files and mixed Norwegian/English field values.
- FR-4: The parser must normalize amounts from Norwegian number format into numeric values.
- FR-5: The parser must reject or ignore non-NOK rows and surface import diagnostics.
- FR-6: Rows where booking date is `Reservert` must be ignored and excluded from analytics.
- FR-7: The system must deduplicate overlapping imports using a deterministic transaction fingerprint.
- FR-8: The system must store transactions in SQLite using Prisma schema optimized for local read performance.
- FR-9: The system must support rule-based categorization by keyword/merchant/payment-type mapping.
- FR-10: The system must optionally call OpenAI for category suggestions when an API key is configured.
- FR-11: The system must provide a manual review queue before category assignments are finalized.
- FR-12: The dashboard must provide interactive graphs for cashflow, inflow/outflow, category distribution, and account state trend.
- FR-13: The system must support filtering analytics by account and date range.
- FR-14: All monetary displays must be in NOK format.
- FR-15: UI components for forms, tables, dialogs, and controls must use shadcn component patterns.
- FR-16: The application must run locally without authentication.

## 5. Non-Goals (Out of Scope)

- Bank API integrations or live syncing from financial institutions.
- Multi-user accounts, cloud sync, or remote hosting requirements.
- Full accounting features (invoicing, tax filing, double-entry bookkeeping).
- Automatic reconciliation with external ledgers.
- Mobile native apps.
- Advanced ML training pipeline for custom categorization models.

## 6. Design Considerations

- Use existing Next.js + Tailwind foundation and shadcn primitives for consistent local UI.
- Prioritize at-a-glance dashboard cards plus graph-first layout.
- Category review should be table-centric with fast inline edits.
- Date and account filters should remain visible while scrolling dashboard content.
- Use clear import feedback states: success, partial success, error.

## 7. Technical Considerations

- Stack: Next.js (App Router), Tailwind, shadcn/ui, SQLite, Prisma.
- CSV parsing must handle UTF-8 Norwegian text and decimal commas.
- Deduplication requires normalized text canonicalization (trim, uppercase/lowercase strategy, whitespace collapse).
- OpenAI integration must be optional and feature-flagged via environment variable/API key presence.
- Raspberry Pi compatibility: avoid heavy native dependencies that break ARM installs.
- Keep persistence model simple:
  - `accounts`
  - `transactions`
  - `categories`
  - `category_rules`
  - optional `categorization_suggestions`

## 8. Success Metrics

- 100% of uploaded files produce an import summary (imported/skipped/ignored/errors).
- Duplicate overlap imports do not increase final transaction count incorrectly.
- User can complete upload-to-approved-categories flow in under 10 minutes for a typical monthly file.
- Dashboard loads main charts within 2 seconds for at least 50,000 stored transactions on local machine.
- User can understand monthly net cashflow and top spending categories without exporting data elsewhere.

## 9. Open Questions

- Account setup conflict in answers: should v1 be strictly fixed to exactly 4 accounts (`4A`) or start with 4 defaults but remain editable (`4B`)? This PRD currently assumes `4B`.
- Should transfers between own accounts be auto-detected and excluded from “spending” totals?
- Should category review support undo/history for bulk actions?
- Which charting library should be preferred for shadcn-friendly integration (e.g., Recharts vs ECharts)?
- Should ignored `Reservert` rows be optionally viewable in an “ignored records” audit tab?

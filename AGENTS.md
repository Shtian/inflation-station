# AGENTS.md

## Purpose
This file guides LLM agents working in this repository. Keep context small, act incrementally, and prefer verified edits over broad assumptions.

## Progressive Disclosure (Required)
1. Start with only `README.md`, `package.json`, and the files directly related to the user request.
2. Expand scope only when blocked.
3. Read the minimum needed lines/sections; do not bulk-load folders.
4. Validate after each meaningful change (lint/typecheck/test only what is relevant).

## Repository Snapshot (Only What Matters)
- App: Next.js + TypeScript (`src/`)
- Database: Prisma (`prisma/`, `prisma.config.ts`)
- API backend: App Router route handlers (`src/app/api/**`) use a shared server-only Prisma client (`src/lib/prisma.ts`)
- Import parsing convention: parser modules should return typed valid rows, structured row-level validation errors, and a stable `summary` shape (`imported`, `duplicates`, `ignoredReserved`, `invalid`) for importer diagnostics.
- Data modeling convention: `Transaction` stores `normalizedMerchant` + `paymentType` for deterministic dedupe and category-rule workflows.
- Dedupe convention: build fingerprints from `accountId`, `bookingDate`, `amountNok`, `normalizedMerchant`, and `paymentType`, and keep that aligned with the Prisma unique constraint on `Transaction`.
- Import pipeline convention: normalize bank CSV payment-type labels (for example `Kort`) to Prisma `PaymentType` enum values before fingerprint dedupe and persistence so duplicate detection stays deterministic across uploads.
- Import normalization convention: centralize merchant/payment-type token normalization in `src/lib/import/normalization.ts` (including Nordic character folding) and run that normalization before any fingerprint-based dedupe or duplicate-warning checks.
- Categorization convention: apply category rules deterministically (priority first, then specificity) and persist suggestions with source/confidence/reasoning while leaving unmatched transactions uncategorized for review.
- Review workflow convention: keep review edits ephemeral until explicit submit; apply approved categories and clear related suggestions atomically so pending queues stay consistent.
- OpenAI suggestion convention: keep AI categorization optional behind `OPENAI_API_KEY`; unresolved transactions may receive `OPENAI` suggestions, and provider/network failures must not fail the import pipeline.
- Monthly review persistence convention: store one `MonthlyReview` row per calendar month using unique `monthStart`, and track generation lifecycle with persisted `status`, optional `generatedAt`, and optional `errorMessage`/`reviewText` for replaceable month-level outputs.
- Monthly review system-prompt convention: persist configurable prompt text in a singleton `MonthlyReviewSystemPrompt` row (`id = "monthly-review-system-prompt"`), and treat missing/blank prompt values as fallback-to-default at read/use time.
- Monthly review overview convention: keep deterministic month aggregation logic in `src/lib/monthly-review/overview.ts`, count spend from negative transactions only, exclude transactions whose linked category has `kind = TRANSFER` while still including uncategorized rows, include review-only months, and compute month-over-month spend deltas only when the immediate prior calendar month exists.
- Monthly review timeline API convention: compose `/api/monthly-review/timeline` data via `src/lib/monthly-review/timeline.ts` so overview rows always include explicit review states (`NOT_GENERATED`, `GENERATING`, `GENERATED`, `FAILED`) with stable validation/server error responses from the route handler.
- Monthly review generation-input convention: build month-scoped AI input in `src/lib/monthly-review/generation-input.ts` with validated `monthStart` (`YYYY-MM-01`), resolved system prompt fallback, full-month transaction rows using minimal fields, precomputed spend/category/merchant/MoM metrics, and transfer-category exclusion (`category.kind = TRANSFER`) applied to spend-side metrics while keeping uncategorized spend included.
- Monthly review manual-generation convention: keep generation orchestration in `src/lib/monthly-review/generation.ts` with replace semantics (`GENERATING` reset, then `GENERATED`/`FAILED`), and expose `/api/monthly-review/generate` as a thin route that maps invalid payload/month validation/server failures to stable errors while returning provider/key failures as persisted `FAILED` month states (`key_missing`, `timeout`, `provider_error`).
- Monthly review route convention: keep timeline fetch/render state in `src/app/monthly-review/monthly-review-manager.tsx`, render the manager from `/monthly-review/page.tsx`, and show explicit per-month empty-state text when `reviewState` is `NOT_GENERATED`.
- Monthly review generation UX convention: in `src/app/monthly-review/monthly-review-manager.tsx`, expose per-month `Generate review` (no prior output) and `Regenerate review` (existing month row) actions, require AlertDialog confirmation with mode-specific copy before `POST /api/monthly-review/generate`, and refresh timeline rows after successful mutation.
- Monthly review timeline content convention: on `/monthly-review`, surface review-state-specific card messaging (`GENERATING` in-progress copy, `FAILED` error details) and render generated review text as a concise preview with an explicit full-text toggle.
- Monthly review timeline metric convention: for each month on `/monthly-review`, treat the primary large value as `monthlyBalanceNok` (`totalIncomeNok - totalSpendNok`) and display explicit companion labels/values for both total spend and total income.
- Monthly review prompt-settings convention: expose prompt read/update through `/api/monthly-review/system-prompt` with stable payload/server error responses, and keep prompt editor state/feedback in `src/app/monthly-review/settings/monthly-review-settings-manager.tsx` so empty prompt saves continue using backend fallback defaults.
- Import AI cleanup convention: run review-stage OpenAI message cleanup as best-effort only, surface parse/review diagnostics via stable unavailable reason codes (`disabled`, `key_missing`, `timeout`, `provider_error`), and never block staging when enrichment fails.
- Dashboard analytics convention: keep aggregate query logic in `src/lib/dashboard/*` with stable date-bucketed numeric series, and keep `/api/dashboard/*` routes focused on filter parsing and validation.
- Dashboard transfer-exclusion convention: when computing Overview spend/income analytics (`netCashflow`, `inflowOutflow`, `categoryBreakdown`) in `src/lib/dashboard/analytics.ts`, exclude transactions whose linked category has `kind = TRANSFER` while still including uncategorized transactions.
- Transfer-exclusion regression convention: when changing transfer handling in analytics/review metrics, update coverage in `src/lib/dashboard/analytics.test.ts`, `src/lib/monthly-review/overview.test.ts`, and `src/lib/monthly-review/generation-input.test.ts` to assert transfer rows are excluded while non-transfer and uncategorized rows remain included.
- Analytics transfer-messaging convention: keep concise inline copy visible in normal page flow on `/` and `/monthly-review` stating that transfer-category transactions are excluded from spend/income analytics.
- Transactions API convention: keep transaction query/mutation logic in `src/lib/transactions/*`, and keep `/api/transactions*` handlers focused on payload/query validation plus HTTP error mapping.
- Transaction detail API convention: for `/api/transactions/[transactionId]`, validate `transactionId` params before mutation methods and map Prisma `P2025` to `TRANSACTION_NOT_FOUND` for both update/delete flows.
- Empty response convention: in Next.js App Router handlers, use `new Response(null, { status: 204 })` for no-content responses instead of `NextResponse.json` to avoid invalid 204 response construction.
- Transactions route convention: keep account/pagination filter and transactions/accounts/categories loading state in `src/app/transactions/use-transactions-manager.ts`, and fetch `/api/transactions` whenever account, page, or page size changes.
- Transactions table convention: on `/transactions`, render rows with shadcn table primitives and keep pagination/total summary text outside the table so empty states stay explicit.
- Transactions category-display convention: include `categoryName` in `/api/transactions` list rows (resolved via category relation) so the table can render category labels and explicit uncategorized states without extra client fetches.
- Transactions edit convention: keep row edit dialog state local to `src/app/transactions/*`, submit mutable fields through `/api/transactions/[transactionId]`, enforce NOK-only currency in this workflow (no editable currency input), and refresh the current paginated query after save so filter/page context remains stable.
- Transaction note convention: persist transaction notes as nullable plain text (`null` when absent) and normalize optional note payloads before transaction create/update writes so API and Prisma mutation shapes stay deterministic.
- Transaction note validation convention: keep note length limits centralized in `src/lib/transactions/note.ts`, enforce the same max-length rule in both `/api/imports/submit` and `/api/transactions/[transactionId]`, and surface note validation feedback near note inputs before submit.
- Transactions note-edit convention: include `note` in `/api/transactions` list rows so `/transactions` edit dialogs can prefill existing notes without an extra detail fetch before save.
- Transactions note-display convention: render a dedicated notes column in `/transactions` and show explicit empty-state text for null notes so note visibility does not depend on opening edit dialogs.
- Transactions delete convention: keep row delete confirmation state local to `src/app/transactions/*`, submit deletes through `/api/transactions/[transactionId]`, and refetch the paginated query so out-of-range pages fall back to a valid page after removals.
- Transactions dialog component convention: keep `/transactions` edit/delete dialog markup in focused components under `src/app/transactions/components/*` and pass typed props from `transactions-manager.tsx` so mutation workflow logic stays isolated from table rendering.
- Dashboard UI convention: keep chart/filter state client-side in route-local overview modules (`src/app/overview/*`, preferably a dedicated hook) and fetch `/api/dashboard/analytics` on every account/date filter change so visuals stay in sync with backend aggregates.
- Dashboard chart convention: render overview visualizations through shadcn chart primitives in `src/components/ui/chart.tsx` (Recharts-backed `ChartContainer` + tooltip helpers) so charts stay tokenized and dark-mode compatible.
- Route convention: keep primary app navigation in `src/app/layout.tsx` and redirect `/` to `/overview` so analytics remains the default landing workspace.
- Route resilience convention: for major routes under `src/app/*`, add route-local `loading.tsx` and `error.tsx` boundaries and reuse `src/components/route-loading-state.tsx` + `src/components/route-error-state.tsx` for consistent fallback UX.
- Route page layout convention: avoid duplicate page/card headings and reduce nested bordered cards; for multi-section route content, prefer section blocks separated with `src/components/ui/separator.tsx`.
- Table UI convention: when rendering tabular data, use the canonical shadcn table primitives from `src/components/ui/table.tsx` (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`) instead of ad-hoc table markup.
- Theming convention: define shadcn-compatible semantic tokens in `src/app/globals.css` and prefer token utilities (`bg-background`, `text-foreground`, `border-border`, etc.) in shared UI primitives instead of hardcoded palette classes.
- Dark mode convention: manage light/dark state with `next-themes` (`src/components/theme-provider.tsx`) using the `html` class strategy, and keep the global theme toggle in `src/components/theme-toggle.tsx` within the app shell.
- Import route convention: keep CSV upload/account selection UI in `src/app/import/*` and stage valid parse rows through `/api/imports/parse` into `ImportReviewSession`/`ImportReviewRow` before any transaction persistence.
- Import workflow convention: keep `/import` parse/submit request orchestration and per-row decision state transitions in `src/app/import/use-import-workflow.ts`, keep `import-uploader.tsx` focused on route-level orchestration + provider dialog state, and keep upload/review phase rendering in focused components under `src/app/import/components/*`.
- Import review component convention: keep the provider selection dialog and import-review row controls in focused components under `src/app/import/components/*`, while preserving stable row-specific accessible control names (for example `Category for row N`, `Toggle message source for row N`, `Note for row N`).
- Import provider detection convention: evaluate provider mappings in `/api/imports/parse` using configurable header/pattern rules, and always return parse `detection` diagnostics with provider id/name plus confidence state (`certain`, `uncertain`, `missing`).
- Import provider override convention: when parse detection is `uncertain` or `missing` and provider candidates exist, `/api/imports/parse` should return `PROVIDER_SELECTION_REQUIRED` with diagnostics and wait for an explicit `providerId` override before continuing parse staging.
- Import provider transform convention: when a provider is selected/detected, load its `ImportProviderMapping` + `ImportProviderFieldMapping` records in `/api/imports/parse` and transform provider CSV rows into canonical parser rows before `ImportReviewSession` staging.
- Import provider admin API convention: manage provider mapping CRUD via `/api/import-provider-mappings` and block create/update when required canonical mapping fields are missing.
- Import provider admin UI convention: keep provider mapping CRUD interactions and user-facing validation feedback in `src/app/import-provider-mappings/*`, backed directly by `/api/import-provider-mappings*`.
- Import provider admin component convention: in `/import-provider-mappings`, keep add/edit dialogs and mappings table/actions in focused components under `src/app/import-provider-mappings/components/*`, and reuse a shared field-mappings editor between create/edit flows.
- Import provider mappings utility convention: keep normalization rules parsing/building and field-mapping validation helpers in route-local utilities (`src/app/import-provider-mappings/provider-mappings-manager.utils.ts`) so behavior is reusable and unit-testable outside the manager component.
- Import review submit convention: persist transactions only via `/api/imports/submit` using staged `sessionId` + per-row finalized decisions (category + selected message text), then clear the submitted `ImportReviewSession` to keep non-submitted reviews ephemeral.
- Import review UX convention: after successful `/api/imports/submit`, clear client-side review/file state in `/import` and keep a concise summary notice visible so the flow deterministically returns to parse-ready state.
- Import review suggestion convention: prefill staged review row `categoryId` values via deterministic category-rule matching, and fall back to uncategorized rows if suggestion lookup fails.
- Import review duplicate convention: compute potential duplicate warnings from the transaction fingerprint fields (`accountId`, `bookingDate`, `amountNok`, `normalizedMerchant`, `paymentType`) and surface warnings in review payloads without dropping rows.
- Import review row-control convention: for per-row category controls in `/import`, keep explicit accessible names on the combobox input (for example `Category for row N`) so Playwright/user-facing locators can uniquely target row-specific pickers.
- Category picker convention: use the shared `CategoryCombobox` for category selection in import review, transaction edit, and category-rule flows, with `showClear` enabled when uncategorized is valid and combobox `autoHighlight` enabled for keyboard-first selection.
- Provider mapping convention: store provider definitions in `ImportProviderMapping` with child `ImportProviderFieldMapping` rows, keep normalization/transform payloads in JSON fields, and persist `mappingVersion` metadata for diagnostics.
- Account route convention: keep account load/create/edit/delete orchestration in `src/app/accounts/use-accounts-manager.ts`, keep forms/tables in route-local section components under `src/app/accounts/components/*`, and keep user-facing success/error feedback local to the accounts route.
- Categories route convention: keep category/category-rule CRUD interactions and user-facing success/error feedback in `src/app/categories/*`, backed by `/api/categories` and `/api/category-rules` handlers, keep shared scope-label + mutation-error helpers in route-local utilities (`categories-manager.utils.ts`), and keep category/rule CRUD UI split into `components/category-management-section.tsx` and `components/rules-management-section.tsx`.
- E2E testing convention: keep Playwright specs under `tests/e2e/*.e2e.ts` and run them via Playwright CLI (`pnpm test:e2e`); use `pnpm test:unit` for Vitest-only loops when `pnpm test` runs full unit+E2E checks.
- Task artifacts/specs: `tasks/`, `ralph/`, `prompt.md`
- Tooling: `biome.json`, `tsconfig.json`, `next.config.ts`

## Working Rules for Agents
- Prefer `rg`/`rg --files` for discovery.
- Make the smallest safe change that satisfies the request.
- Do not refactor unrelated code.
- Preserve existing style and architecture unless asked otherwise.
- Add or update unit tests for behavior changes whenever the code under change is testable.
- After Prisma schema changes, run `pnpm exec prisma generate` before TypeScript/build checks.
- If assumptions are required, state them briefly.

## Validation Strategy
Run only what matches the change scope:
- Formatting/linting: `pnpm lint` (or targeted checks when possible)
- Build/type safety: `pnpm build`
- Tests: `pnpm test` (or targeted tests). For behavior changes, tests are required unless there is a documented blocker.

If validation is skipped, explicitly state what was not run and why.

## Output Expectations
- Reference exact file paths changed.
- Summarize behavior impact, not just code edits.
- Call out risks, edge cases, or follow-ups only when relevant.

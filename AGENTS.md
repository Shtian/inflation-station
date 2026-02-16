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
- Categorization convention: apply category rules deterministically (priority first, then specificity) and persist suggestions with source/confidence/reasoning while leaving unmatched transactions uncategorized for review.
- Review workflow convention: keep review edits ephemeral until explicit submit; apply approved categories and clear related suggestions atomically so pending queues stay consistent.
- OpenAI suggestion convention: keep AI categorization optional behind `OPENAI_API_KEY`; unresolved transactions may receive `OPENAI` suggestions, and provider/network failures must not fail the import pipeline.
- Dashboard analytics convention: keep aggregate query logic in `src/lib/dashboard/*` with stable date-bucketed numeric series, and keep `/api/dashboard/*` routes focused on filter parsing and validation.
- Dashboard UI convention: keep chart/filter state client-side in the page component and fetch `/api/dashboard/analytics` on every account/date filter change so visuals stay in sync with backend aggregates.
- Dashboard chart convention: render overview visualizations through shadcn chart primitives in `src/components/ui/chart.tsx` (Recharts-backed `ChartContainer` + tooltip helpers) so charts stay tokenized and dark-mode compatible.
- Route convention: keep primary app navigation in `src/app/layout.tsx` and redirect `/` to `/overview` so analytics remains the default landing workspace.
- Route page layout convention: avoid duplicate page/card headings and reduce nested bordered cards; for multi-section route content, prefer section blocks separated with `src/components/ui/separator.tsx`.
- Table UI convention: when rendering tabular data, use the canonical shadcn table primitives from `src/components/ui/table.tsx` (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`) instead of ad-hoc table markup.
- Theming convention: define shadcn-compatible semantic tokens in `src/app/globals.css` and prefer token utilities (`bg-background`, `text-foreground`, `border-border`, etc.) in shared UI primitives instead of hardcoded palette classes.
- Dark mode convention: manage light/dark state with `next-themes` (`src/components/theme-provider.tsx`) using the `html` class strategy, and keep the global theme toggle in `src/components/theme-toggle.tsx` within the app shell.
- Import route convention: keep CSV upload/account selection UI in `src/app/import/*` and stage valid parse rows through `/api/imports/parse` into `ImportReviewSession`/`ImportReviewRow` before any transaction persistence.
- Import review submit convention: persist transactions only via `/api/imports/submit` using staged `sessionId` + row category decisions, then clear the submitted `ImportReviewSession` to keep non-submitted reviews ephemeral.
- Import review UX convention: after successful `/api/imports/submit`, clear client-side review/file state in `/import` and keep a concise summary notice visible so the flow deterministically returns to parse-ready state.
- Import review suggestion convention: prefill staged review row `categoryId` values via deterministic category-rule matching, and fall back to uncategorized rows if suggestion lookup fails.
- Import review duplicate convention: compute potential duplicate warnings from the transaction fingerprint fields (`accountId`, `bookingDate`, `amountNok`, `normalizedMerchant`, `paymentType`) and surface warnings in review payloads without dropping rows.
- Account route convention: keep account CRUD interactions and user-facing success/error feedback in `src/app/accounts/*`, while other routes consume `/api/accounts` only for selection/filtering.
- Categories route convention: keep category/category-rule CRUD interactions and user-facing success/error feedback in `src/app/categories/*`, backed by `/api/categories` and `/api/category-rules` handlers.
- E2E testing convention: keep Playwright specs under `tests/e2e/*.e2e.ts` and run them via Playwright CLI so Vitest (`pnpm test`) does not pick up browser tests.
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

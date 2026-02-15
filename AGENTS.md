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

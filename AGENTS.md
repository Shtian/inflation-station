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
- Data modeling convention: `Transaction` stores `normalizedMerchant` + `paymentType` for deterministic dedupe and category-rule workflows.
- Task artifacts/specs: `tasks/`, `ralph/`, `prompt.md`
- Tooling: `biome.json`, `tsconfig.json`, `next.config.ts`

## Working Rules for Agents
- Prefer `rg`/`rg --files` for discovery.
- Make the smallest safe change that satisfies the request.
- Do not refactor unrelated code.
- Preserve existing style and architecture unless asked otherwise.
- After Prisma schema changes, run `pnpm exec prisma generate` before TypeScript/build checks.
- If assumptions are required, state them briefly.

## Validation Strategy
Run only what matches the change scope:
- Formatting/linting: `pnpm lint` (or targeted checks when possible)
- Build/type safety: `pnpm build`
- Tests: `pnpm test` (or targeted tests)

If validation is skipped, explicitly state what was not run and why.

## Output Expectations
- Reference exact file paths changed.
- Summarize behavior impact, not just code edits.
- Call out risks, edge cases, or follow-ups only when relevant.

# AGENTS.md

Inflation Station is a Next.js + TypeScript personal-finance app with Prisma-backed imports, transaction workflows, and monthly AI-assisted review generation.

## Essentials for all tasks
- Package manager: `pnpm` (not npm).
- Work with progressive disclosure: start with `README.md`, `package.json`, and directly relevant files; expand only when blocked.
- Make the smallest safe change; do not refactor unrelated code.
- Preserve existing architecture and style unless asked to change them.
- If behavior changes and tests are feasible, add or update tests.
- When migrating inline success feedback to Sonner toasts, update Playwright assertions that currently use `getByText("...added/updated/removed/saved...")` so E2E coverage follows the feedback surface change.
- After Prisma schema changes, run `pnpm exec prisma generate` before type/build checks.
- For Server Action mutations, use `src/lib/server-actions/mutation-result.ts` to keep validation and typed error contracts consistent with existing API error-code semantics.
- For deterministic category color changes, keep `getDeterministicColorFromText` return shape stable and update `src/lib/deterministic-color.test.ts` in the same change.
- For `uncategorized` fallback color changes, keep `src/lib/category-color.ts` and `src/lib/category-color.test.ts` in sync, and return valid CSS color strings consumed by category badges/charts.

## Validation defaults
- Run targeted validation matching the change scope, typically once per completed change set.
- Common commands: `pnpm lint`, `pnpm build`, `pnpm test`.
- Useful targeted loops: `pnpm test:unit`, `pnpm test:e2e`, `pnpm typecheck`.
- If any validation is skipped, state what was skipped and why.

## Agent skills

### Issue tracker

Issues live as GitHub issues (Shtian/inflation-station), managed via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix` labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout - CONTEXT.md + docs/adr/ at repo root (created lazily as needed). See `docs/agents/domain.md`.

## Folder-specific guidance (load only when working there)
- `src/app/AGENTS.md`
- `src/app/(overview)/AGENTS.md`
- `src/app/import/AGENTS.md`
- `src/app/import-provider-mappings/AGENTS.md`
- `src/app/transactions/AGENTS.md`
- `src/app/monthly-review/AGENTS.md`
- `src/app/accounts/AGENTS.md`
- `src/app/categories/AGENTS.md`
- `src/app/api/AGENTS.md`
- `src/app/api/imports/AGENTS.md`
- `src/app/api/transactions/AGENTS.md`
- `src/app/api/monthly-review/AGENTS.md`
- `src/app/api/dashboard/AGENTS.md`
- `src/app/api/import-provider-mappings/AGENTS.md`
- `src/lib/import/AGENTS.md`
- `src/lib/transactions/AGENTS.md`
- `src/lib/monthly-review/AGENTS.md`
- `src/lib/dashboard/AGENTS.md`
- `src/components/AGENTS.md`
- `src/components/ui/AGENTS.md`

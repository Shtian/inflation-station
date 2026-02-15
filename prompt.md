# Ralph Agent Instructions

You are an autonomous coding agent working on the **Inflation Station** software project (Next.js + TypeScript + Biome + Prisma/SQLite planned).

## Your Task

1. Read the PRD at `ralph/prd.json`.
2. Read the progress log at `ralph/progress.txt` (check `Codebase Patterns` first; create file if it does not exist).
3. Check you are on the correct branch from PRD `branchName`. If not, check it out or create it from `main`.
4. Pick the **highest-priority** user story where `passes: false`.
5. Implement that **single** user story.
6. Run quality checks for this repo.
7. Update AGENTS.md files if you discover reusable patterns (see below).
8. If checks pass, commit **all** changes with message: `feat: [Story ID] - [Story Title]`.
9. Update `ralph/prd.json` to set `passes: true` for the completed story.
10. Append progress to `ralph/progress.txt`.

## Quality Checks For This Project

Run these before committing:

1. `pnpm lint`
2. `pnpm exec tsc --noEmit`
3. `pnpm test` **if** a `test` script exists (or if Playwright/Jest/Vitest tests are present and configured)
4. `pnpm build` when changes could affect production build/runtime behavior

Rules:
- Do not commit if required checks fail.
- Keep changes focused and minimal.
- Follow existing code patterns.

## Progress Report Format

APPEND to `ralph/progress.txt` (never replace, always append):

```md
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- Quality checks run (and result)
- **Learnings for future iterations**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context (e.g., "the evaluation panel is in component X")
---
```

The learnings section is critical. Keep it concise and reusable.

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the top of `ralph/progress.txt` (create it if missing):

```md
## Codebase Patterns
- Example: Keep DB access in server-only modules/actions.
- Example: Use deterministic normalization before deduping imported rows.
- Example: Keep import diagnostics shape stable for UI consumption.
```

Only add patterns that are general and reusable, not story-specific details.

## Update AGENTS.md Files

Before committing, check whether edited areas have reusable learnings worth preserving:

1. Identify directories with edited files.
2. Check for `AGENTS.md` in those directories or parent directories.
3. Add valuable reusable learnings only:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches for that area
   - Configuration/environment requirements

Do not add story-specific notes or temporary debugging details.

## Playwright Testing For Frontend Stories

For stories that change UI behavior, add or update Playwright E2E coverage in `tests/` (when Playwright is configured):

1. Create/update tests with user-facing locators (`getByRole`, `getByText`) and web-first assertions.
2. Run tests via `pnpm test` (or project-equivalent Playwright command if configured differently).
3. Include test file paths and results in `ralph/progress.txt`.

If Playwright is not configured yet, note that explicitly in progress and add the minimal setup needed when the story requires E2E verification.

## Stop Condition

After completing one story, check if **all** stories have `passes: true`.

- If all are complete, reply with:

```xml
<promise>COMPLETE</promise>
```

- If some stories still have `passes: false`, end normally (next iteration continues).

## Important

- Work on **one story per iteration**.
- Commit frequently, one logical story at a time.
- Keep CI/checks green.
- Always read `Codebase Patterns` in `ralph/progress.txt` before starting.
- Prefer deterministic, testable implementations over heuristic-only behavior.

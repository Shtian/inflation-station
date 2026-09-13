# Tests AGENTS

Load this when working in `tests`.

Two Playwright projects live here. The **stubbed suite** intercepts every API call and serves fixtures to the browser. The **integrated suite** runs against a real Next server backed by a real migrated database. `CONTEXT.md` defines both terms.

- Keep stubbed specs in `tests/e2e/*.e2e.ts` and integrated specs in `tests/integrated/*.integrated.ts`, both named after the user story they cover (`us-0NN-<slug>`). `testMatch` keys off the extension, so a file in the right directory with the wrong extension runs in neither project.
- Assert Sonner feedback with `page.locator("[data-sonner-toast]", { hasText: "..." })` instead of inline banner DOM or bare `getByText`.
- When a route migrates inline success feedback to toasts, update its spec's assertions in the same change; inline error copy stays asserted as inline DOM.
- Unit tests for application code are colocated with their source in `src/**/*.test.ts` (Vitest). The Vitest files here cover the support modules in `tests/support/` and the suites' own invariants, neither of which has a `src/` counterpart to sit beside.

## Database isolation differs by suite

Per-test database isolation governs the Vitest domain tests. Use `tests/support/prisma-test-db.ts` there: each `createTestDatabase()` call gets its own temp file, so those tests never share a database.

The integrated suite cannot do that. One server process reads `DATABASE_URL` once at boot, so every integrated test in a run shares that one database. It isolates by **serialised reset** instead, recorded in `docs/adr/0001-integrated-e2e-isolates-by-serialised-reset.md`:

- Declare `{ lock: INTEGRATED_DB_LOCK }` on every integrated test. Tests sharing a lock name never run concurrently, across files, workers, and projects.
- Call `layFixture()` from `tests/support/integrated-database.ts` first in every integrated test. It truncates every table and inserts the rows you state, so no test depends on another test's data or on the demo dataset.
- Keep `fullyParallel: true` on both projects. In default or serial mode Playwright holds a lock for the whole file rather than for one test, which coarsens the isolation unit without saying so.
- Do not add `--shard`. Locks are enforced within one `playwright test` run and give no mutual exclusion across shard invocations.
- Write fixtures with `layFixture()`, never through the API or the UI. Setup that routes through the code under test reproduces the same defect in the fixture, so the assertion agrees with the bug instead of catching it.

## Running the suites

- `pnpm exec playwright test` runs both projects. `--project=stubbed` and `--project=integrated` run one.
- The stubbed server binds `http://127.0.0.1:3000` and runs against `prisma/stubbed.db`. Three stubbed specs drive Server Actions, which POST to the page's own URL rather than to `/api/*`, so `page.route` cannot intercept them and they reach a real database. Giving that server one of its own keeps a suite run off `prisma/dev.db`.
- That holds when Playwright starts the server. It still reuses an already-running dev server locally, and that server has whatever `DATABASE_URL` you started it with. Stop it first if you want the guarantee. Set `PLAYWRIGHT_NO_WEBSERVER=1` to start neither server yourself.
- The integrated server binds `http://127.0.0.1:3001`, owns that port outright, and runs against `prisma/integrated.db`. Locally it builds into `.next-integrated`, because a second `next dev` out of one directory refuses to start.
- Both suites run chromium-only.
- `prisma/dev.db` is gitignored, so it exists on your machine and not in CI. A test that reads it, or builds a path to it, has to behave the same when the file is missing, or it passes locally and fails on the pull request.

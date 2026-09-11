# Tests AGENTS

Load this when working in `tests`.

- Keep Playwright specs in `tests/e2e/*.e2e.ts`, named after the user story they cover (`us-0NN-<slug>.e2e.ts`).
- Assert Sonner feedback with `page.locator("[data-sonner-toast]", { hasText: "..." })` instead of inline banner DOM or bare `getByText`.
- When a route migrates inline success feedback to toasts, update its spec's assertions in the same change; inline error copy stays asserted as inline DOM.
- Use `tests/support/prisma-test-db.ts` for per-test database isolation; specs run `fullyParallel`, so never share a database file between tests.
- Suite runs chromium-only against `http://127.0.0.1:3000`, auto-starting `pnpm dev`. Set `PLAYWRIGHT_NO_WEBSERVER=1` to run against an already-running server.
- Unit tests are colocated with their source in `src/**/*.test.ts` (Vitest), not here.

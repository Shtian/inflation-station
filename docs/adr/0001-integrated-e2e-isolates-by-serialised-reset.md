# Integrated e2e isolates by serialised reset, not a database per test

Status: accepted

The integrated Playwright suite runs a real browser against a real Next.js
server against a real SQLite file. Unlike the Vitest domain tests — which call
`createTestDatabase()` and get a private temp database per test — an e2e test
cannot have its own database, because a server process reads `DATABASE_URL`
once at boot and every test in the run shares that one server.

We therefore isolate by **serialised reset**: every integrated test declares
Playwright's `lock: 'integrated-db'`, and truncates to empty and lays down its
own fixture before it runs. Tests sharing a lock name never run concurrently —
across files, workers and projects — so exactly one integrated test touches
the database at a time, while the stubbed suite continues to run fully
parallel alongside it.

## Considered options

**A database per worker.** Genuinely isolating, and the only option that
satisfies the original "never share a database file" rule literally. Rejected
because one server reads one `DATABASE_URL`, so a database per worker really
means a *server* per worker: N `next start` processes on N ports, started
manually, with a worker-scoped fixture rewriting `baseURL`. That is a large
amount of bespoke machinery to maintain for four tests.

**Shared database, tests run in parallel, each owning uniquely-named data.**
Cheapest, and it works on the Playwright version we were already on. Rejected
because the suite's flagship assertion is a negative one — after editing a
merchant, searching for the *old* merchant must return nothing — and a
negative assertion over a shared dataset is only sound if no other row
anywhere happens to carry that string. That obligation would have to be
honoured by every fixture value in every future test, forever, and silently
produces false passes when someone forgets.

The `lock` primitive (new in Playwright 1.63) is what changed the answer: it
made per-test reset possible for the first time, because nothing else is
writing while a test holds the lock.

## Consequences

- **The integrated project must keep `fullyParallel: true`.** In default or
  serial mode a lock is held for the duration of the whole *file* rather than
  the individual test, which silently coarsens the isolation unit.
- **Sharding is off the table** while this holds. Locks are enforced by a
  single dispatcher within one `playwright test` run and provide no mutual
  exclusion across `--shard` invocations.
- **The suite has a floor of Playwright 1.63.** `TestDetails.lock` does not
  exist in 1.62 or earlier.
- Truncation runs from the spec process against the same file the live server
  holds open, so the integrated database is in WAL mode.
- Because truncation is destructive by design, the helper that performs it
  refuses to run against `prisma/dev.db`.
- **The integrated server needs its own build directory locally.** Measured on
  Next 16.2.1: a second `next dev` in the same directory exits with "Another
  next dev server is already running", and a `next dev` that reuses a
  directory holding a production build serves 500s from every API route. The
  integrated `webServer` entry therefore sets `NEXT_DIST_DIR` outside CI. In CI
  both servers run `next start` off the single `.next` build, so it must not be
  set there.
- **Every server this suite starts names its own database.** Three stubbed
  specs exercise Server Actions, which POST to the page's own URL rather than
  to `/api/*`, so `page.route` cannot intercept them and they reach whichever
  database their server is pointed at. The stubbed server therefore gets
  `prisma/stubbed.db` just as the integrated one gets `prisma/integrated.db`,
  and a full run leaves `prisma/dev.db` untouched. The exception is a dev
  server you started yourself, which the stubbed entry still reuses and which
  keeps the `DATABASE_URL` you gave it.

import { defineConfig, devices } from "@playwright/test";
import { INTEGRATED_DATABASE_URL } from "./tests/support/integrated-database";

const STUBBED_PORT = 3000;
const INTEGRATED_PORT = 3001;
const INTEGRATED_DIST_DIR = ".next-integrated";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Every stubbed spec stubs its own network traffic, so specs share no state
  // and parallelism is safe. The integrated specs do share a database, and
  // serialise on `lock` rather than on the worker count. GitHub-hosted runners
  // have 4 vCPUs and two are busy serving Next, so leave headroom rather than
  // using the default 50%.
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: `http://127.0.0.1:${STUBBED_PORT}`,
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_NO_WEBSERVER
    ? undefined
    : [
        {
          // In CI a prebuilt production server starts in ~1s and serves every
          // route immediately; `next dev` would recompile each route on first
          // visit and dominate the run.
          command: process.env.CI
            ? `pnpm start --port ${STUBBED_PORT}`
            : `pnpm dev --port ${STUBBED_PORT}`,
          port: STUBBED_PORT,
          reuseExistingServer: !process.env.CI,
        },
        {
          // The migration is chained into the command because Playwright starts
          // `webServer` before `globalSetup` and before project dependencies:
          // nothing else runs early enough to prepare a file this server opens
          // at boot. `src/lib/prisma.ts` reads DATABASE_URL once at module
          // evaluation, so it has to be in the environment from the start.
          command: process.env.CI
            ? `pnpm db:migrate:deploy && pnpm start --port ${INTEGRATED_PORT}`
            : `pnpm db:migrate:deploy && pnpm dev --port ${INTEGRATED_PORT}`,
          port: INTEGRATED_PORT,
          env: {
            DATABASE_URL: INTEGRATED_DATABASE_URL,
            // `next dev` refuses to start a second time out of one directory,
            // and a `next dev` reusing a directory that holds a production
            // build serves 500s from every API route. In CI both servers run
            // `next start` off the one build and share `.next`.
            ...(process.env.CI ? {} : { NEXT_DIST_DIR: INTEGRATED_DIST_DIR }),
          },
          // This server owns its port; reusing whatever happens to be listening
          // would silently test against another database.
          reuseExistingServer: false,
          // The default 60s does not cover a migration plus a cold `next dev`.
          timeout: 180_000,
        },
      ],
  projects: [
    {
      name: "stubbed",
      testDir: "./tests/e2e",
      // Matched on the file extension, not the directory alone, so a misplaced
      // file cannot silently join the wrong suite.
      testMatch: "**/*.e2e.ts",
      fullyParallel: true,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "integrated",
      testDir: "./tests/integrated",
      testMatch: "**/*.integrated.ts",
      // Holding `lock` for one test rather than one whole file depends on this.
      // Default and serial modes coarsen the isolation unit silently.
      fullyParallel: true,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${INTEGRATED_PORT}`,
      },
      // A test waits for the lock, and locally for `next dev` to compile the
      // route it visits first.
      timeout: 120_000,
    },
  ],
});

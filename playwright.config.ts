import { defineConfig, devices } from "@playwright/test";
import { INTEGRATED_DATABASE_URL } from "./tests/support/integrated-database";

const STUBBED_PORT = 3000;
const INTEGRATED_PORT = 3001;
const INTEGRATED_DIST_DIR = ".next-integrated";

// Three stubbed specs drive Server Actions, which POST to the page's own URL
// rather than to `/api/*`, so `page.route` cannot intercept them and they reach
// whichever database their server is pointed at. Giving that server one of its
// own keeps a suite run off `prisma/dev.db`.
const STUBBED_DATABASE_URL = "file:./prisma/stubbed.db";

const STUBBED_PROJECT = "stubbed";
const INTEGRATED_PROJECT = "integrated";

/**
 * Playwright starts every `webServer` entry before it filters by `--project`,
 * so a plain array would make `--project=stubbed` wait on, and fail with, a
 * server it never talks to. Anything this cannot read confidently, a glob
 * among them, selects both rather than risk leaving a project with no server.
 */
function selectedProjects(): readonly string[] {
  const selected: string[] = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];

    if (arg.startsWith("--project=")) {
      selected.push(arg.slice("--project=".length));
      continue;
    }

    if (arg !== "--project") {
      continue;
    }

    // `--project` takes a list, so every value up to the next flag is a name.
    for (
      let value = index + 1;
      value < process.argv.length && !process.argv[value].startsWith("-");
      value += 1
    ) {
      selected.push(process.argv[value]);
    }
  }

  if (selected.length === 0 || selected.some((name) => /[*?[\]]/.test(name))) {
    return [STUBBED_PROJECT, INTEGRATED_PROJECT];
  }

  return selected;
}

const stubbedServer = {
  // In CI a prebuilt production server starts in ~1s and serves every route
  // immediately; `next dev` would recompile each route on first visit and
  // dominate the run.
  command: process.env.CI
    ? `pnpm db:migrate:deploy && pnpm start --port ${STUBBED_PORT}`
    : `pnpm db:migrate:deploy && pnpm dev --port ${STUBBED_PORT}`,
  port: STUBBED_PORT,
  env: { DATABASE_URL: STUBBED_DATABASE_URL },
  // Reusing a dev server the developer already had running is the point of
  // this entry. That server has its own DATABASE_URL, so the `env` above only
  // applies when Playwright starts the server itself.
  reuseExistingServer: !process.env.CI,
};

const integratedServer = {
  // The migration is chained into the command because Playwright starts
  // `webServer` before `globalSetup` and before project dependencies: nothing
  // else runs early enough to prepare a file this server opens at boot.
  command: process.env.CI
    ? `pnpm db:migrate:deploy && pnpm start --port ${INTEGRATED_PORT}`
    : `pnpm db:migrate:deploy && pnpm dev --port ${INTEGRATED_PORT}`,
  port: INTEGRATED_PORT,
  env: {
    DATABASE_URL: INTEGRATED_DATABASE_URL,
    // Only outside CI. CI builds once and runs `next start` for both servers
    // off that one `.next`; locally the second server is a `next dev` and
    // needs a build directory of its own.
    ...(process.env.CI ? {} : { NEXT_DIST_DIR: INTEGRATED_DIST_DIR }),
  },
  reuseExistingServer: false,
  timeout: 180_000,
};

const projects = selectedProjects();

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // GitHub-hosted runners have 4 vCPUs and two are busy serving Next, so leave
  // headroom rather than using the default 50%.
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: `http://127.0.0.1:${STUBBED_PORT}`,
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_NO_WEBSERVER
    ? undefined
    : [
        ...(projects.includes(STUBBED_PROJECT) ? [stubbedServer] : []),
        ...(projects.includes(INTEGRATED_PROJECT) ? [integratedServer] : []),
      ],
  projects: [
    {
      name: STUBBED_PROJECT,
      testDir: "./tests/e2e",
      testMatch: "**/*.e2e.ts",
      fullyParallel: true,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: INTEGRATED_PROJECT,
      testDir: "./tests/integrated",
      testMatch: "**/*.integrated.ts",
      // Measured: in serial mode a lock is held until the whole file finishes,
      // including its unlocked tests, so the isolation unit silently coarsens
      // from one test to one file. See docs/adr/0001.
      fullyParallel: true,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${INTEGRATED_PORT}`,
      },
      timeout: 120_000,
    },
  ],
});

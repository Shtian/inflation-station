import { defineConfig, devices } from "@playwright/test";
import { INTEGRATED_DATABASE_URL } from "./tests/support/integrated-database";

/**
 * Several worktrees of this repo run at once, and the stubbed entry reuses
 * whatever server already holds its port. Without an override, a worktree
 * whose neighbour holds 3000 tests the neighbour's code.
 */
function portFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a TCP port, got "${raw}"`);
  }

  return port;
}

const APP_SERVERS = ["next", "start"] as const;
type AppServer = (typeof APP_SERVERS)[number];

/** Which app the suites run against while Next and TanStack Start live side by side. */
function appServerFromEnv(name: string): AppServer {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return "next";
  }

  const server = APP_SERVERS.find((candidate) => candidate === raw);
  if (server === undefined) {
    throw new Error(
      `${name} must be one of ${APP_SERVERS.join(", ")}, got "${raw}"`,
    );
  }

  return server;
}

const APP_SERVER = appServerFromEnv("PLAYWRIGHT_SERVER");
const STUBBED_PORT = portFromEnv("PLAYWRIGHT_STUBBED_PORT", 3000);
const INTEGRATED_PORT = portFromEnv("PLAYWRIGHT_INTEGRATED_PORT", 3001);
// Three stubbed specs drive Server Actions, which POST to the page's own URL
// rather than to `/api/*`, so `page.route` cannot intercept them and they reach
// whichever database their server is pointed at. Giving that server one of its
// own keeps a suite run off `prisma/dev.db`.
const STUBBED_DATABASE_URL = "file:./prisma/stubbed.db";

const STUBBED_PROJECT = "stubbed";
const INTEGRATED_PROJECT = "integrated";

type Project = typeof STUBBED_PROJECT | typeof INTEGRATED_PROJECT;
type ServerLaunch = { command: string; env: Record<string, string> };

// Nitro's production server takes its address from the env.
function serveStartOutput(port: number): ServerLaunch {
  return {
    command: "pnpm start:serve",
    env: { PORT: String(port), HOST: "127.0.0.1" },
  };
}

/**
 * In CI a prebuilt production server starts in ~1s and serves every route
 * immediately; a dev server would recompile each route on first visit and
 * dominate the run. CI builds once and runs both production servers off that
 * one build; locally each Next suite gets a dev server of its own.
 */
const LAUNCHERS: Record<
  AppServer,
  Record<"dev" | "prod", (port: number, project: Project) => ServerLaunch>
> = {
  next: {
    // `next dev` refuses to start a second time from the same directory, so
    // the integrated dev server needs a build directory of its own.
    dev: (port, project): ServerLaunch => ({
      command: `pnpm dev --port ${port}`,
      env:
        project === INTEGRATED_PROJECT
          ? { NEXT_DIST_DIR: ".next-integrated" }
          : {},
    }),
    prod: (port) => ({ command: `pnpm start --port ${port}`, env: {} }),
  },
  start: {
    // Start's dev client hydrates through a dynamic import that the `load`
    // event does not wait for, so specs would click before React attaches.
    // Both modes serve the prebuilt output; run `pnpm start:build` first.
    dev: serveStartOutput,
    prod: serveStartOutput,
  },
};

const launchServer = LAUNCHERS[APP_SERVER][process.env.CI ? "prod" : "dev"];

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

const stubbedLaunch = launchServer(STUBBED_PORT, STUBBED_PROJECT);
const stubbedServer = {
  command: `pnpm db:migrate:deploy && ${stubbedLaunch.command}`,
  port: STUBBED_PORT,
  env: { DATABASE_URL: STUBBED_DATABASE_URL, ...stubbedLaunch.env },
  // Reusing a dev server the developer already had running is the point of
  // this entry. That server has its own DATABASE_URL, so the `env` above only
  // applies when Playwright starts the server itself.
  reuseExistingServer: !process.env.CI,
};

const integratedLaunch = launchServer(INTEGRATED_PORT, INTEGRATED_PROJECT);
const integratedServer = {
  // The migration is chained into the command because Playwright starts
  // `webServer` before `globalSetup` and before project dependencies: nothing
  // else runs early enough to prepare a file this server opens at boot.
  command: `pnpm db:migrate:deploy && ${integratedLaunch.command}`,
  port: INTEGRATED_PORT,
  env: { DATABASE_URL: INTEGRATED_DATABASE_URL, ...integratedLaunch.env },
  reuseExistingServer: false,
  timeout: 180_000,
};

const projects = selectedProjects();

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // GitHub-hosted runners have 4 vCPUs and two are busy serving the app, so leave
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

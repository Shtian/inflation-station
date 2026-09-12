import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Every spec stubs its own network traffic, so specs share no state and
  // parallelism is safe. GitHub-hosted runners have 4 vCPUs and one is busy
  // serving Next, so leave headroom rather than using the default 50%.
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_NO_WEBSERVER
    ? undefined
    : {
        // In CI a prebuilt production server starts in ~1s and serves every
        // route immediately; `next dev` would recompile each route on first
        // visit and dominate the run.
        command: process.env.CI
          ? "pnpm start --port 3000"
          : "pnpm dev --port 3000",
        port: 3000,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

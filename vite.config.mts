import { execSync } from "node:child_process";
import path from "node:path";
import babel from "@rolldown/plugin-babel";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite-plus";
import packageJson from "./package.json" with { type: "json" };
import { getSentryRelease } from "./src/lib/sentry/release";

const SERVER_ONLY_ID = "\0server-only";

/**
 * `src/lib/prisma.ts` imports `server-only`. The server environments get an
 * empty module, and a client bundle that reaches it fails the build.
 */
function serverOnly(): Plugin {
  return {
    name: "inflation-station:server-only",
    enforce: "pre",
    resolveId(id) {
      return id === "server-only" ? SERVER_ONLY_ID : null;
    },
    load(id) {
      if (id !== SERVER_ONLY_ID) return null;
      if (this.environment.name === "client") {
        this.error(
          "A server-only module (such as @/lib/prisma) was imported into the client bundle.",
        );
      }
      return "export {};";
    },
  };
}

// Docker builds have no .git, so they pass the commit in SOURCE_COMMIT.
function getBuildSha(): string {
  if (process.env.SOURCE_COMMIT) return process.env.SOURCE_COMMIT.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig(async ({ mode }) => {
  const buildSha = getBuildSha();
  // Importing the plugin resolves `.env.schema` into `process.env`. Tests
  // skip it and replace `varlock/env` with a stub (tests/support/config-env).
  const varlock =
    mode === "test" ? undefined : await import("@varlock/vite-integration");
  // Read from `process.env` because `ENV` throws on invalid config before the
  // plugin can stop the build with its own validation report.
  const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env;

  return {
    lint: {
      plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y"],
      categories: { correctness: "error" },
      rules: {
        // React Compiler diagnostics. Clearing them changes component
        // behavior, so they wait for their own change.
        "react/set-state-in-effect": "off",
        "react/refs": "off",
        "react/incompatible-library": "off",
        // role="img" on drawn charts and role="group" on ButtonGroup have no
        // matching intrinsic tag.
        "jsx-a11y/prefer-tag-over-role": "off",
      },
      ignorePatterns: [
        "src/routeTree.gen.ts",
        "src/components/ui/**",
        ".agents/**",
        ".claude/**",
      ],
    },
    fmt: {
      printWidth: 80,
      sortPackageJson: false,
      sortImports: {
        groups: [
          "builtin",
          "external",
          "internal",
          ["parent", "sibling", "index"],
        ],
        newlinesBetween: false,
        partitionByNewline: true,
      },
      sortTailwindcss: {
        stylesheet: "./src/app/globals.css",
        functions: ["clsx", "cva", "cn", "tw"],
      },
      ignorePatterns: [
        "src/routeTree.gen.ts",
        ".agents/**",
        ".claude/**",
        ".playwright-cli/**",
        "**/*.md",
        "**/*.yml",
        "**/*.yaml",
      ],
      overrides: [
        {
          files: ["src/components/ui/**"],
          options: { sortImports: false, sortTailwindcss: false },
        },
      ],
    },
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
      "import.meta.env.VITE_BUILD_SHA": JSON.stringify(buildSha),
      "import.meta.env.VITE_BUILD_TIME": JSON.stringify(
        new Date().toISOString(),
      ),
    },
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "src") },
    },
    test: {
      setupFiles: ["tests/support/config-env.ts"],
    },
    plugins: [
      // `auto-load` resolves server config when the built server boots, so
      // one build serves the stubbed and integrated E2E databases.
      varlock?.varlockVitePlugin({ ssrInjectMode: "auto-load" }),
      serverOnly(),
      tailwindcss(),
      // Keep colocated tests out of the route tree.
      tanstackStart({ router: { routeFileIgnorePattern: "\\.test\\.tsx?$" } }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      // Nitro only builds the server bundle. Under `vp test` its dev runner
      // evaluates CommonJS deps as ESM and logs `exports is not defined`.
      mode !== "test" && nitro(),
      // Source maps upload only when a token is present, so builds without
      // Sentry stay quiet and offline.
      sentryTanstackStart({
        authToken: SENTRY_AUTH_TOKEN,
        org: SENTRY_ORG,
        project: SENTRY_PROJECT,
        sourcemaps: { disable: !SENTRY_AUTH_TOKEN },
        release: { name: getSentryRelease(packageJson.version, buildSha) },
        silent: !process.env.CI,
        telemetry: false,
      }),
    ],
  };
});

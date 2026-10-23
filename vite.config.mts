import { execSync } from "node:child_process";
import path from "node:path";
import babel from "@rolldown/plugin-babel";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { loadEnv } from "vite";
import { defineConfig, type Plugin } from "vite-plus";

const SERVER_ONLY_ID = "\0server-only";

/**
 * `src/lib/prisma.ts` imports `server-only`, which Next resolves from its own
 * bundle. Keep the guard: the server environments get an empty module, and a
 * client bundle that reaches it fails the build.
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

function getGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const buildSha = getGitSha();

  return {
    // Both apps share one `.env` while they run side by side, so the Start
    // build reads the Next names.
    define: {
      "import.meta.env.VITE_BUILD_SHA": JSON.stringify(buildSha),
      "import.meta.env.VITE_BUILD_TIME": JSON.stringify(
        new Date().toISOString(),
      ),
      "import.meta.env.VITE_SENTRY_DSN": JSON.stringify(
        env.NEXT_PUBLIC_SENTRY_DSN ?? "",
      ),
      "import.meta.env.VITE_SENTRY_ENVIRONMENT": JSON.stringify(
        env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "",
      ),
    },
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "src") },
    },
    // postcss.config.mjs belongs to Next; Tailwind runs through its Vite plugin here.
    css: { postcss: { plugins: [] } },
    plugins: [
      serverOnly(),
      tailwindcss(),
      // Keep colocated tests out of the route tree.
      tanstackStart({ router: { routeFileIgnorePattern: "\\.test\\.tsx?$" } }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      nitro(),
      // Source maps upload only when a token is present, so builds without
      // Sentry stay quiet and offline.
      sentryTanstackStart({
        authToken: env.SENTRY_AUTH_TOKEN,
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        sourcemaps: { disable: !env.SENTRY_AUTH_TOKEN },
        release: { name: buildSha },
        silent: !process.env.CI,
        telemetry: false,
      }),
    ],
  };
});

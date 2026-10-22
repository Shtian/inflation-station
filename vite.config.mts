import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
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

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  // postcss.config.mjs belongs to Next; Tailwind runs through its Vite plugin here.
  css: { postcss: { plugins: [] } },
  plugins: [
    serverOnly(),
    tailwindcss(),
    tanstackStart(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    nitro(),
  ],
});

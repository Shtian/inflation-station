import { execSync } from "node:child_process";
import type { NextConfig } from "next";

function getGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

process.env.NEXT_PUBLIC_BUILD_SHA = getGitSha();
process.env.NEXT_PUBLIC_BUILD_TIME = new Date().toISOString();

const nextConfig: NextConfig = {
  // Production deploys ship a standalone server, but `next start` refuses to
  // serve a standalone build, so CI can opt out to get a fast production
  // server for the E2E suite.
  output: process.env.NEXT_OUTPUT === "default" ? undefined : "standalone",
  // `next dev` refuses to start a second time from the same directory, so the
  // integrated E2E server needs a build directory of its own to coexist with
  // the stubbed suite's server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;

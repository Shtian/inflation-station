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
  output: "standalone",
  reactCompiler: true,
};

export default nextConfig;

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { checkUpdateAvailability } from "./availability";

let dir: string;

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
}

function initRepo(repo: string) {
  git(repo, "config", "user.name", "Test");
  git(repo, "config", "user.email", "test@example.com");
}

function commit(repo: string, content: string) {
  writeFileSync(path.join(repo, "file.txt"), content);
  git(repo, "add", "file.txt");
  git(repo, "commit", "-m", content);
}

function clone(name: string) {
  const target = path.join(dir, name);
  git(dir, "clone", "-q", path.join(dir, "remote.git"), target);
  initRepo(target);
  return target;
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "self-update-availability-"));
  git(dir, "init", "-q", "--bare", "-b", "main", "remote.git");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("checkUpdateAvailability", () => {
  it("compares the build sha against the upstream branch on the remote", async () => {
    const site = clone("site");
    commit(site, "first");
    git(site, "push", "-q", "-u", "origin", "main");
    const buildSha = git(site, "rev-parse", "--short", "HEAD");

    expect(await checkUpdateAvailability(site, buildSha)).toEqual({
      kind: "up-to-date",
    });

    const dev = clone("dev");
    commit(dev, "second");
    git(dev, "push", "-q", "origin", "main");
    const remoteSha = git(dev, "rev-parse", "HEAD").slice(0, 7);

    expect(await checkUpdateAvailability(site, buildSha)).toEqual({
      kind: "available",
      remoteSha,
    });
  });

  it("reports unknown when the branch has no upstream", async () => {
    const repo = path.join(dir, "standalone");
    git(dir, "init", "-q", "-b", "main", repo);
    initRepo(repo);
    commit(repo, "first");

    expect(
      await checkUpdateAvailability(
        repo,
        git(repo, "rev-parse", "--short", "HEAD"),
      ),
    ).toEqual({ kind: "unknown" });
  });
});

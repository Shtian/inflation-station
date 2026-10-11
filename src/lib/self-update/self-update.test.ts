import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSelfUpdateStatus } from "./self-update";

let root: string;

function writeState(files: Record<string, string>) {
  const dir = path.join(root, ".update");
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content);
  }
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "self-update-status-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("readSelfUpdateStatus", () => {
  it("reports never-run when no state directory exists", async () => {
    expect(await readSelfUpdateStatus(root, "abc1234")).toEqual({
      sha: "abc1234",
      log: "",
      phase: "never-run",
    });
  });

  it("reports running while the lock holds a live pid", async () => {
    writeState({
      lock: `${process.pid}\n`,
      "update.log": "==> Pulling latest changes...\n",
    });

    expect(await readSelfUpdateStatus(root, "abc1234")).toEqual({
      sha: "abc1234",
      log: "==> Pulling latest changes...",
      phase: "running",
    });
  });

  it("ignores a stale lock and falls back to the recorded result", async () => {
    const deadPid = spawnSync("true").pid;
    writeState({ lock: `${deadPid}\n`, "update.log": "boom\n", result: "3\n" });

    expect(await readSelfUpdateStatus(root, "abc1234")).toEqual({
      sha: "abc1234",
      log: "boom",
      phase: "finished",
      exitCode: 3,
    });
  });

  it("reports never-run for a stale lock without a result", async () => {
    const deadPid = spawnSync("true").pid;
    writeState({ lock: `${deadPid}\n`, "update.log": "killed midway\n" });

    expect(await readSelfUpdateStatus(root, "abc1234")).toEqual({
      sha: "abc1234",
      log: "killed midway",
      phase: "never-run",
    });
  });

  it("reports the exit code of a finished run", async () => {
    writeState({ result: "0\n", "update.log": "==> Already up to date\n" });

    expect(await readSelfUpdateStatus(root, "abc1234")).toEqual({
      sha: "abc1234",
      log: "==> Already up to date",
      phase: "finished",
      exitCode: 0,
    });
  });

  it("keeps only the last 200 log lines", async () => {
    const lines = Array.from({ length: 250 }, (_, i) => `line ${i + 1}`);
    writeState({ result: "0\n", "update.log": `${lines.join("\n")}\n` });

    const status = await readSelfUpdateStatus(root, "abc1234");

    const logLines = status.log.split("\n");
    expect(logLines).toHaveLength(200);
    expect(logLines[0]).toBe("line 51");
    expect(logLines[199]).toBe("line 250");
  });
});

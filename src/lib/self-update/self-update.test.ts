import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
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
      progress: null,
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
      progress: { label: "Henter endringer", index: 0, total: 6, percent: 0 },
      phase: "running",
    });
  });

  it("estimates progress from this run's steps and the last successful run", async () => {
    writeState({
      lock: `${process.pid}\n`,
      "update.log": "==> Building...\n",
      steps: "install 0\nmigrate 20000\nbuild 25000\n",
      "steps.last":
        "install 1000\nmigrate 31000\nbuild 35000\nassemble 125000\nrestart 126000\nend 130000\n",
    });

    expect(await readSelfUpdateStatus(root, "abc1234", 70_000)).toEqual({
      sha: "abc1234",
      log: "==> Building...",
      progress: { label: "Bygger", index: 4, total: 6, percent: 61 },
      phase: "running",
    });
  });

  it("leaves progress out once the run has finished", async () => {
    writeState({ result: "0\n", steps: "install 0\n" });

    expect((await readSelfUpdateStatus(root, "abc1234")).progress).toBeNull();
  });

  it("ignores a stale lock and falls back to the recorded result", async () => {
    const deadPid = spawnSync("true").pid;
    writeState({ lock: `${deadPid}\n`, "update.log": "boom\n", result: "3\n" });

    expect(await readSelfUpdateStatus(root, "abc1234")).toEqual({
      sha: "abc1234",
      log: "boom",
      progress: null,
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
      progress: null,
      phase: "never-run",
    });
  });

  it("reports the exit code of a finished run", async () => {
    writeState({ result: "0\n", "update.log": "==> Already up to date\n" });

    expect(await readSelfUpdateStatus(root, "abc1234")).toEqual({
      sha: "abc1234",
      log: "==> Already up to date",
      progress: null,
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

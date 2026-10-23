import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

const SCRIPT = path.join(__dirname, "self-update.sh");
const MARKER = "FAKE_UPDATE_RAN";

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

let tmp: string;
let origin: string;
let app: string;

function git(cwd: string, ...args: string[]) {
  execFileSync("git", args, { cwd, env: gitEnv, stdio: "pipe" });
}

function writeFakeUpdate(dir: string, exitCode: number) {
  writeFileSync(
    path.join(dir, "update.sh"),
    `echo ${MARKER}\nexit ${exitCode}\n`,
  );
}

function pushToOrigin(change: (dir: string) => void) {
  const other = path.join(tmp, "other");
  git(tmp, "clone", "-q", origin, other);
  change(other);
  git(other, "add", "-A");
  git(other, "commit", "-qm", "upstream change");
  git(other, "push", "-q", "origin", "main");
}

function runSelfUpdate() {
  return spawnSync("bash", [path.join(app, "scripts/self-update.sh")], {
    env: gitEnv,
    encoding: "utf8",
  });
}

function stateFile(name: string) {
  return path.join(app, ".update", name);
}

function read(name: string) {
  return readFileSync(stateFile(name), "utf8");
}

function deadPid() {
  return spawnSync("true").pid;
}

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "self-update-"));
  origin = path.join(tmp, "origin.git");
  app = path.join(tmp, "app");
  git(tmp, "init", "-q", "--bare", "-b", "main", origin);
  git(tmp, "clone", "-q", origin, app);
  git(app, "checkout", "-q", "-b", "main");
  mkdirSync(path.join(app, "scripts"));
  copyFileSync(SCRIPT, path.join(app, "scripts/self-update.sh"));
  writeFakeUpdate(app, 0);
  writeFileSync(path.join(app, ".gitignore"), "/.update/\n");
  git(app, "add", "-A");
  git(app, "commit", "-qm", "initial");
  git(app, "push", "-q", "-u", "origin", "main");
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("scripts/self-update.sh", () => {
  it("skips update.sh when the pull brings nothing new", () => {
    const run = runSelfUpdate();

    expect(run.status).toBe(0);
    expect(read("result")).toBe("0\n");
    expect(read("update.log")).toContain("==> Already up to date");
    expect(read("update.log")).not.toContain(MARKER);
    expect(existsSync(stateFile("lock"))).toBe(false);
  });

  it("runs the pulled update.sh when origin has new commits", () => {
    pushToOrigin((dir) => writeFileSync(path.join(dir, "new.txt"), "new\n"));

    const run = runSelfUpdate();

    expect(run.status).toBe(0);
    expect(read("result")).toBe("0\n");
    expect(read("update.log")).toContain(MARKER);
    expect(read("update.log")).not.toContain("Already up to date");
    expect(readFileSync(path.join(app, "new.txt"), "utf8")).toBe("new\n");
    expect(existsSync(stateFile("lock"))).toBe(false);
  });

  it("records the exit code of a failing update.sh", () => {
    pushToOrigin((dir) => writeFakeUpdate(dir, 3));

    const run = runSelfUpdate();

    expect(run.status).toBe(3);
    expect(read("result")).toBe("3\n");
    expect(read("update.log")).toContain(MARKER);
    expect(existsSync(stateFile("lock"))).toBe(false);
  });

  it("reclaims a lock whose pid is dead", () => {
    mkdirSync(path.join(app, ".update"));
    writeFileSync(stateFile("lock"), `${deadPid()}\n`);

    const run = runSelfUpdate();

    expect(run.status).toBe(0);
    expect(read("result")).toBe("0\n");
    expect(read("update.log")).toContain("==> Already up to date");
    expect(existsSync(stateFile("lock"))).toBe(false);
  });

  it("refuses to start while a live process holds the lock", () => {
    mkdirSync(path.join(app, ".update"));
    writeFileSync(stateFile("lock"), `${process.pid}\n`);
    writeFileSync(stateFile("update.log"), "previous run\n");
    writeFileSync(stateFile("result"), "0\n");

    const run = runSelfUpdate();

    expect(run.status).toBe(75);
    expect(run.stderr).toBe(
      `An update is already running (pid ${process.pid}).\n`,
    );
    expect(read("update.log")).toBe("previous run\n");
    expect(read("result")).toBe("0\n");
    expect(read("lock")).toBe(`${process.pid}\n`);
  });
});

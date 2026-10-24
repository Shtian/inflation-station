import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  estimateProgress,
  parseStepMarks,
  type SelfUpdateProgress,
  stepDurations,
} from "./progress";

export type SelfUpdatePhase =
  | { phase: "never-run" }
  | { phase: "running" }
  | { phase: "finished"; exitCode: number };

export type SelfUpdateStatus = {
  sha: string;
  log: string;
  progress: SelfUpdateProgress | null;
} & SelfUpdatePhase;

const LOG_TAIL_LINES = 200;

export function selfUpdateStateDir(root: string) {
  return path.join(root, ".update");
}

async function readOptional(file: string) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function tail(text: string) {
  const lines = text.replace(/\n$/, "").split("\n");
  return lines.slice(-LOG_TAIL_LINES).join("\n");
}

async function readPhase(stateDir: string): Promise<SelfUpdatePhase> {
  const lock = await readOptional(path.join(stateDir, "lock"));
  const pid = Number(lock?.trim());
  if (Number.isInteger(pid) && pid > 0 && isAlive(pid)) {
    return { phase: "running" };
  }

  const result = await readOptional(path.join(stateDir, "result"));
  const exitCode = Number(result?.trim());
  if (result === null || !Number.isInteger(exitCode)) {
    return { phase: "never-run" };
  }
  return { phase: "finished", exitCode };
}

async function readProgress(
  stateDir: string,
  nowMs: number,
): Promise<SelfUpdateProgress> {
  const [current, previous] = await Promise.all([
    readOptional(path.join(stateDir, "steps")),
    readOptional(path.join(stateDir, "steps.last")),
  ]);
  return estimateProgress(
    parseStepMarks(current ?? ""),
    stepDurations(parseStepMarks(previous ?? "")),
    nowMs,
  );
}

export async function readSelfUpdateStatus(
  root: string,
  sha: string,
  nowMs = Date.now(),
): Promise<SelfUpdateStatus> {
  const stateDir = selfUpdateStateDir(root);
  const [phase, log] = await Promise.all([
    readPhase(stateDir),
    readOptional(path.join(stateDir, "update.log")),
  ]);
  const progress =
    phase.phase === "running" ? await readProgress(stateDir, nowMs) : null;
  return { sha, log: log === null ? "" : tail(log), progress, ...phase };
}

// The Nitro server does not set NODE_ENV, but pm2 passes on whatever the
// shell or `.env` holds. NODE_ENV=production would make `pnpm install` skip
// the devDependencies the build needs.
function updateEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key !== "NODE_ENV" && !key.startsWith("__NEXT"),
    ),
  ) as NodeJS.ProcessEnv;
}

export function spawnSelfUpdate(root: string) {
  // pm2 kills every descendant of the app (it walks ppid) when update.sh
  // restarts it. The inner `&` lets the outer bash exit at once, so the wrapper
  // is reparented to init and survives the restart it triggers.
  spawn(
    "bash",
    [
      "-c",
      'nohup "$0" >/dev/null 2>&1 &',
      path.join(root, "scripts/self-update.sh"),
    ],
    { cwd: root, detached: true, stdio: "ignore", env: updateEnv() },
  ).unref();
}

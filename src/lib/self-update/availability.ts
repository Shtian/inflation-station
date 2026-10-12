import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type UpdateAvailability =
  | { kind: "up-to-date" }
  | { kind: "available"; remoteSha: string }
  | { kind: "unknown" };

const GIT_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

const execFileAsync = promisify(execFile);

async function git(root: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: root,
    timeout: GIT_TIMEOUT_MS,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout.trim();
}

// ls-remote rather than fetch: self-update.sh may be running `git pull` at the
// same time, and a fetch would race it on refs and FETCH_HEAD. ls-remote
// writes nothing locally.
export async function checkUpdateAvailability(
  root: string,
  buildSha: string,
): Promise<UpdateAvailability> {
  // Dev and CI builds without git report "unknown" as their sha.
  if (!/^[0-9a-f]{4,40}$/.test(buildSha)) {
    return { kind: "unknown" };
  }
  try {
    const head = await git(root, ["symbolic-ref", "-q", "HEAD"]);
    const upstream = await git(root, [
      "for-each-ref",
      "--format=%(upstream:remotename) %(upstream:remoteref)",
      head,
    ]);
    const [remote, remoteRef] = upstream.split(" ");
    if (!remote || !remoteRef) {
      return { kind: "unknown" };
    }
    const remoteSha = (await git(root, ["ls-remote", remote, remoteRef])).split(
      /\s/,
    )[0];
    if (!remoteSha) {
      return { kind: "unknown" };
    }
    return remoteSha.startsWith(buildSha)
      ? { kind: "up-to-date" }
      : { kind: "available", remoteSha: remoteSha.slice(0, 7) };
  } catch {
    return { kind: "unknown" };
  }
}

let cached: { at: number; result: Promise<UpdateAvailability> } | null = null;

export function getUpdateAvailability(root: string, buildSha: string) {
  if (!cached || Date.now() - cached.at > CACHE_TTL_MS) {
    cached = {
      at: Date.now(),
      result: checkUpdateAvailability(root, buildSha),
    };
  }
  return cached.result;
}

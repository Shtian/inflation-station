import { execFile } from "node:child_process";
import type { CreatedIssue } from "./contract";

const GH_TIMEOUT_MS = 30_000;

export type CommandResult = {
  stdout: string;
  stderr: string;
  error: Error | null;
};

export type CommandRunner = (
  command: string,
  args: string[],
  stdin: string,
) => Promise<CommandResult>;

export class GithubIssueError extends Error {
  name = "GithubIssueError";
}

const defaultRunner: CommandRunner = (command, args, stdin) =>
  new Promise((resolve) => {
    const child = execFile(
      command,
      args,
      { timeout: GH_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({ stdout, stderr, error });
      },
    );
    child.stdin?.end(stdin);
  });

const ISSUE_URL_PATTERN = /https:\/\/\S+\/issues\/(\d+)/;

export async function createGithubIssue(
  input: { repo: string; title: string; body: string; labels: string[] },
  run: CommandRunner = defaultRunner,
): Promise<CreatedIssue> {
  const args = [
    "issue",
    "create",
    "--repo",
    input.repo,
    "--title",
    input.title,
    "--body-file",
    "-",
    ...input.labels.flatMap((label) => ["--label", label]),
  ];
  const { stdout, stderr, error } = await run("gh", args, input.body);
  if (error) {
    throw new GithubIssueError(
      `Could not create the GitHub issue: ${stderr.trim() || error.message}`,
    );
  }
  const match = ISSUE_URL_PATTERN.exec(stdout);
  if (!match) {
    throw new GithubIssueError(
      `gh did not report an issue URL. Output: ${stdout.trim() || "(empty)"}`,
    );
  }
  return { number: Number(match[1]), url: match[0] };
}

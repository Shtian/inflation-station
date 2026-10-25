import { z } from "zod";
import type { CreatedIssue } from "./contract";

const GITHUB_TIMEOUT_MS = 30_000;

export type FeedbackGithubTarget = { repo: string; token: string };

export type IssueInput = { title: string; body: string; labels: string[] };

export class GithubIssueError extends Error {
  name = "GithubIssueError";
}

const createdIssueResponseSchema = z.object({
  number: z.number().int(),
  html_url: z.url(),
});

const errorResponseSchema = z.object({
  message: z.string(),
  errors: z.array(z.unknown()).optional(),
});

function describeFailure(status: number, text: string): string {
  try {
    const parsed = errorResponseSchema.parse(JSON.parse(text));
    const details = parsed.errors?.length
      ? ` ${JSON.stringify(parsed.errors)}`
      : "";
    return `${status} ${parsed.message}${details}`;
  } catch {
    return `${status} ${text.trim() || "(tomt svar)"}`;
  }
}

export async function createGithubIssue(
  target: FeedbackGithubTarget,
  issue: IssueInput,
  fetchFn: typeof fetch = fetch,
): Promise<CreatedIssue> {
  let response: Response;
  try {
    response = await fetchFn(
      `https://api.github.com/repos/${target.repo}/issues`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${target.token}`,
          "Content-Type": "application/json",
          "User-Agent": "inflation-station",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify(issue),
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      },
    );
  } catch (error) {
    throw new GithubIssueError(
      `Kunne ikke nå GitHub: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const text = await response.text();
  if (!response.ok) {
    throw new GithubIssueError(
      `Kunne ikke opprette GitHub-saken: ${describeFailure(response.status, text)}`,
    );
  }
  let created: z.infer<typeof createdIssueResponseSchema>;
  try {
    created = createdIssueResponseSchema.parse(JSON.parse(text));
  } catch {
    throw new GithubIssueError(
      `GitHub oppga ingen URL til saken. Svar: ${text.trim() || "(tomt)"}`,
    );
  }
  return { number: created.number, url: created.html_url };
}

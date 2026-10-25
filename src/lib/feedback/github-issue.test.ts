import { describe, expect, it, vi } from "vite-plus/test";
import { createGithubIssue } from "./github-issue";

const target = { repo: "Shtian/inflation-station", token: "github_pat_test" };

const issue = {
  title: "Save button does nothing",
  body: "## What happened\nNothing.",
  labels: ["bug", "needs-triage"],
};

function respond(status: number, body: string) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(body, { status }));
}

describe("createGithubIssue", () => {
  it("posts the issue to the repo with the token and returns its number and URL", async () => {
    const fetchFn = respond(
      201,
      JSON.stringify({
        number: 171,
        html_url: "https://github.com/Shtian/inflation-station/issues/171",
      }),
    );

    await expect(createGithubIssue(target, issue, fetchFn)).resolves.toEqual({
      number: 171,
      url: "https://github.com/Shtian/inflation-station/issues/171",
    });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(
      "https://api.github.com/repos/Shtian/inflation-station/issues",
    );
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer github_pat_test",
      Accept: "application/vnd.github+json",
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      title: "Save button does nothing",
      body: "## What happened\nNothing.",
      labels: ["bug", "needs-triage"],
    });
  });

  it("includes GitHub's status and message when it rejects the token", async () => {
    const fetchFn = respond(
      401,
      JSON.stringify({
        message: "Bad credentials",
        documentation_url: "https://docs.github.com/rest",
      }),
    );

    await expect(createGithubIssue(target, issue, fetchFn)).rejects.toThrow(
      "Kunne ikke opprette GitHub-saken: 401 Bad credentials",
    );
  });

  it("includes validation errors when GitHub rejects the issue", async () => {
    const fetchFn = respond(
      422,
      JSON.stringify({
        message: "Validation Failed",
        errors: [{ resource: "Issue", field: "title", code: "missing_field" }],
      }),
    );

    await expect(createGithubIssue(target, issue, fetchFn)).rejects.toThrow(
      'Kunne ikke opprette GitHub-saken: 422 Validation Failed [{"resource":"Issue","field":"title","code":"missing_field"}]',
    );
  });

  it("reports a network failure as a GitHub error", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("fetch failed"));

    await expect(createGithubIssue(target, issue, fetchFn)).rejects.toThrow(
      "Kunne ikke nå GitHub: fetch failed",
    );
  });

  it("fails when GitHub answers without an issue URL", async () => {
    const fetchFn = respond(201, JSON.stringify({ number: 171 }));

    await expect(createGithubIssue(target, issue, fetchFn)).rejects.toThrow(
      'GitHub oppga ingen URL til saken. Svar: {"number":171}',
    );
  });
});

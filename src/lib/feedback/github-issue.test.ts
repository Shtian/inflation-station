import { describe, expect, it, vi } from "vite-plus/test";
import { type CommandRunner, createGithubIssue } from "./github-issue";

const input = {
  repo: "Shtian/inflation-station",
  title: "Save button does nothing",
  body: "## What happened\nNothing.",
  labels: ["bug", "needs-triage"],
};

describe("createGithubIssue", () => {
  it("runs gh without a shell, pipes the body on stdin and parses the URL", async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue({
      stdout: "https://github.com/Shtian/inflation-station/issues/171\n",
      stderr: "",
      error: null,
    });

    await expect(createGithubIssue(input, run)).resolves.toEqual({
      number: 171,
      url: "https://github.com/Shtian/inflation-station/issues/171",
    });
    expect(run).toHaveBeenCalledWith(
      "gh",
      [
        "issue",
        "create",
        "--repo",
        "Shtian/inflation-station",
        "--title",
        "Save button does nothing",
        "--body-file",
        "-",
        "--label",
        "bug",
        "--label",
        "needs-triage",
      ],
      "## What happened\nNothing.",
    );
  });

  it("includes stderr in the error when gh fails", async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue({
      stdout: "",
      stderr: "could not add label: 'needs-triage' not found\n",
      error: new Error("Command failed: gh issue create"),
    });

    await expect(createGithubIssue(input, run)).rejects.toThrow(
      "Kunne ikke opprette GitHub-saken: could not add label: 'needs-triage' not found",
    );
  });

  it("fails when gh prints no issue URL", async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue({
      stdout: "Creating issue in Shtian/inflation-station\n",
      stderr: "",
      error: null,
    });

    await expect(createGithubIssue(input, run)).rejects.toThrow(
      "gh oppga ingen URL til saken. Utdata: Creating issue in Shtian/inflation-station",
    );
  });
});

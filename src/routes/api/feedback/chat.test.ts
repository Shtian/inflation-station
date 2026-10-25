import { beforeEach, describe, expect, it } from "vite-plus/test";
import { routeHandler } from "../-route-handler";
import { stubConfig } from "../../../../tests/support/config-env";
import { Route } from "./chat";

const POST = routeHandler(Route, "POST");

function post(body: string) {
  return POST(
    new Request("http://localhost/api/feedback/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
  );
}

describe("POST /api/feedback/chat", () => {
  beforeEach(() => {
    stubConfig({
      OPENAI_API_KEY: "test-key",
      FEEDBACK_GITHUB_REPO: "Shtian/inflation-station",
      FEEDBACK_GITHUB_TOKEN: "github_pat_test",
    });
  });

  it("answers 503 key_missing when there is no API key", async () => {
    stubConfig({ OPENAI_API_KEY: undefined });

    const response = await post(JSON.stringify({ messages: [] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "FEEDBACK_UNAVAILABLE",
      reason: "key_missing",
    });
  });

  it("answers 503 repo_missing when the repo is unset", async () => {
    stubConfig({ FEEDBACK_GITHUB_REPO: undefined });

    const response = await post(JSON.stringify({ messages: [] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "FEEDBACK_UNAVAILABLE",
      reason: "repo_missing",
    });
  });

  it("answers 503 token_missing when the GitHub token is unset", async () => {
    stubConfig({ FEEDBACK_GITHUB_TOKEN: undefined });

    const response = await post(JSON.stringify({ messages: [] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "FEEDBACK_UNAVAILABLE",
      reason: "token_missing",
    });
  });

  it("answers 400 when the body is not JSON", async () => {
    const response = await post("not json");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_FEEDBACK_MESSAGES",
      message: "Forespørselen må være JSON.",
    });
  });

  it("answers 400 when messages are not UI messages", async () => {
    const response = await post(
      JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_FEEDBACK_MESSAGES",
    });
  });

  it("answers 400 when user metadata breaks the schema", async () => {
    const response = await post(
      JSON.stringify({
        messages: [
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "Broken" }],
            metadata: { pathname: 42 },
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_FEEDBACK_MESSAGES",
    });
  });
});

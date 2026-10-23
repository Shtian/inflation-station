import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeHandler } from "../-route-handler";
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
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("FEEDBACK_GITHUB_REPO", "Shtian/inflation-station");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers 503 key_missing when there is no API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await post(JSON.stringify({ messages: [] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "FEEDBACK_UNAVAILABLE",
      reason: "key_missing",
    });
  });

  it("answers 503 repo_missing when the repo is not owner/name", async () => {
    vi.stubEnv("FEEDBACK_GITHUB_REPO", "inflation-station");

    const response = await post(JSON.stringify({ messages: [] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "FEEDBACK_UNAVAILABLE",
      reason: "repo_missing",
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

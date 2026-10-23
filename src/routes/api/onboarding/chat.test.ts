import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { routeHandler } from "../-route-handler";
import { stubConfig } from "../../../../tests/support/config-env";
import { Route } from "./chat";

const POST = routeHandler(Route, "POST");

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

function post(body: string) {
  return POST(
    new Request("http://localhost/api/onboarding/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
  );
}

describe("POST /api/onboarding/chat", () => {
  beforeEach(() => {
    stubConfig({ OPENAI_API_KEY: "test-key" });
  });

  it("answers 503 when there is no API key", async () => {
    stubConfig({ OPENAI_API_KEY: " " });

    const response = await post(JSON.stringify({ messages: [] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "ONBOARDING_UNAVAILABLE",
    });
  });

  it("answers 400 when the body is not JSON", async () => {
    const response = await post("not json");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_ONBOARDING_MESSAGES",
      message: "Forespørselen må være JSON.",
    });
  });

  it("answers 400 when messages are not UI messages", async () => {
    const response = await post(
      JSON.stringify({ messages: [{ role: "user", content: "hei" }] }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_ONBOARDING_MESSAGES",
    });
  });

  it("answers 400 when a proposal breaks the tool input schema", async () => {
    const response = await post(
      JSON.stringify({
        messages: [
          { id: "u1", role: "user", parts: [{ type: "text", text: "Hei" }] },
          {
            id: "a1",
            role: "assistant",
            parts: [
              {
                type: "tool-addAccounts",
                toolCallId: "call-1",
                state: "approval-requested",
                input: { accounts: [] },
                approval: { id: "approval-1" },
              },
            ],
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_ONBOARDING_MESSAGES",
    });
  });
});

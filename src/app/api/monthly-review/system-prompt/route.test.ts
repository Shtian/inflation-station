import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const {
  getMonthlyReviewSystemPromptSettingsMock,
  updateMonthlyReviewSystemPromptSettingsMock,
  prismaMock,
} = vi.hoisted(() => ({
  getMonthlyReviewSystemPromptSettingsMock: vi.fn(),
  updateMonthlyReviewSystemPromptSettingsMock: vi.fn(),
  prismaMock: { _tag: "prisma-mock" },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/monthly-review/system-prompt", () => ({
  getMonthlyReviewSystemPromptSettings:
    getMonthlyReviewSystemPromptSettingsMock,
  updateMonthlyReviewSystemPromptSettings:
    updateMonthlyReviewSystemPromptSettingsMock,
}));

describe("/api/monthly-review/system-prompt", () => {
  beforeEach(() => {
    getMonthlyReviewSystemPromptSettingsMock.mockReset();
    updateMonthlyReviewSystemPromptSettingsMock.mockReset();

    getMonthlyReviewSystemPromptSettingsMock.mockResolvedValue({
      storedPromptText: "Focus on recurring categories.",
      resolvedPrompt: "Focus on recurring categories.",
      isDefault: false,
    });

    updateMonthlyReviewSystemPromptSettingsMock.mockResolvedValue({
      storedPromptText: null,
      resolvedPrompt: "Default prompt",
      isDefault: true,
    });
  });

  it("returns current prompt settings", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(getMonthlyReviewSystemPromptSettingsMock).toHaveBeenCalledWith(
      prismaMock,
    );
    await expect(response.json()).resolves.toEqual({
      promptText: "Focus on recurring categories.",
      resolvedPrompt: "Focus on recurring categories.",
      usesDefaultPrompt: false,
    });
  });

  it("maps fetch failures to stable server error", async () => {
    getMonthlyReviewSystemPromptSettingsMock.mockRejectedValue(
      new Error("boom"),
    );

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "MONTHLY_REVIEW_SYSTEM_PROMPT_FETCH_FAILED",
      message: "Could not load monthly review system prompt.",
    });
  });

  it("returns 400 for invalid update payload", async () => {
    const response = await PUT(
      new Request("http://localhost/api/monthly-review/system-prompt", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: "Missing key",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(updateMonthlyReviewSystemPromptSettingsMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_MONTHLY_REVIEW_SYSTEM_PROMPT_PAYLOAD",
      message: "Expected promptText in request body.",
    });
  });

  it("updates prompt settings", async () => {
    const response = await PUT(
      new Request("http://localhost/api/monthly-review/system-prompt", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          promptText: "  ",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateMonthlyReviewSystemPromptSettingsMock).toHaveBeenCalledWith(
      prismaMock,
      "  ",
    );
    await expect(response.json()).resolves.toEqual({
      promptText: "",
      resolvedPrompt: "Default prompt",
      usesDefaultPrompt: true,
    });
  });

  it("maps update failures to stable server error", async () => {
    updateMonthlyReviewSystemPromptSettingsMock.mockRejectedValue(
      new Error("boom"),
    );

    const response = await PUT(
      new Request("http://localhost/api/monthly-review/system-prompt", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          promptText: "Focus on subscriptions.",
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "MONTHLY_REVIEW_SYSTEM_PROMPT_UPDATE_FAILED",
      message: "Could not update monthly review system prompt.",
    });
  });
});

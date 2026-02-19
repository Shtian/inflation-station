import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT,
  getMonthlyReviewSystemPrompt,
  updateMonthlyReviewSystemPrompt,
} from "./system-prompt";

function createSystemPromptDbMock(promptText: string | null = null) {
  let storedPromptText = promptText;

  return {
    monthlyReviewSystemPrompt: {
      findUnique: vi.fn(async () =>
        storedPromptText === null ? null : { promptText: storedPromptText },
      ),
      upsert: vi.fn(async ({ create, update }) => {
        storedPromptText =
          storedPromptText === null ? create.promptText : update.promptText;
        return { promptText: storedPromptText };
      }),
    },
  };
}

describe("monthly review system prompt", () => {
  it("returns default prompt when no stored prompt exists", async () => {
    const db = createSystemPromptDbMock();

    const result = await getMonthlyReviewSystemPrompt(db);

    expect(result).toEqual({
      prompt: DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT,
      isDefault: true,
    });
  });

  it("returns stored prompt when prompt exists", async () => {
    const db = createSystemPromptDbMock("Use structured bullet points.");

    const result = await getMonthlyReviewSystemPrompt(db);

    expect(result).toEqual({
      prompt: "Use structured bullet points.",
      isDefault: false,
    });
  });

  it("stores non-empty prompt and returns persisted value", async () => {
    const db = createSystemPromptDbMock();

    const result = await updateMonthlyReviewSystemPrompt(
      db,
      "Focus on outliers and recurring merchants.",
    );

    expect(result).toEqual({
      prompt: "Focus on outliers and recurring merchants.",
      isDefault: false,
    });
    expect(db.monthlyReviewSystemPrompt.upsert).toHaveBeenCalledWith({
      where: { id: "monthly-review-system-prompt" },
      create: {
        id: "monthly-review-system-prompt",
        promptText: "Focus on outliers and recurring merchants.",
      },
      update: {
        promptText: "Focus on outliers and recurring merchants.",
      },
      select: { promptText: true },
    });
  });

  it("stores empty prompt as null and falls back to default", async () => {
    const db = createSystemPromptDbMock();

    const result = await updateMonthlyReviewSystemPrompt(db, "   ");

    expect(result).toEqual({
      prompt: DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT,
      isDefault: true,
    });
    expect(db.monthlyReviewSystemPrompt.upsert).toHaveBeenCalledWith({
      where: { id: "monthly-review-system-prompt" },
      create: {
        id: "monthly-review-system-prompt",
        promptText: null,
      },
      update: {
        promptText: null,
      },
      select: { promptText: true },
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT,
  getMonthlyReviewSystemPrompt,
  getMonthlyReviewSystemPromptSettings,
  updateMonthlyReviewSystemPrompt,
  updateMonthlyReviewSystemPromptSettings,
} from "./system-prompt";

function createSystemPromptDbMock(promptText: string | null = null) {
  let storedPromptText = promptText;
  let storedModelId: string | null = null;

  return {
    monthlyReviewSystemPrompt: {
      findUnique: vi.fn(async () =>
        storedPromptText === null && storedModelId === null
          ? null
          : { promptText: storedPromptText, modelId: storedModelId },
      ),
      upsert: vi.fn(async ({ create, update }) => {
        if (storedPromptText === null && storedModelId === null) {
          storedPromptText = create.promptText;
          storedModelId = create.modelId;
        } else {
          storedPromptText = update.promptText;
          storedModelId = update.modelId;
        }

        return { promptText: storedPromptText, modelId: storedModelId };
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
      modelId: "gpt-5.2",
      isDefaultModel: true,
    });
  });

  it("returns stored prompt when prompt exists", async () => {
    const db = createSystemPromptDbMock("Use structured bullet points.");

    const result = await getMonthlyReviewSystemPrompt(db);

    expect(result).toEqual({
      prompt: "Use structured bullet points.",
      isDefault: false,
      modelId: "gpt-5.2",
      isDefaultModel: true,
    });
  });

  it("returns settings view with stored and resolved prompt values", async () => {
    const db = createSystemPromptDbMock();

    const result = await getMonthlyReviewSystemPromptSettings(db);

    expect(result).toEqual({
      storedPromptText: null,
      resolvedPrompt: DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT,
      isDefault: true,
      storedModelId: null,
      resolvedModelId: "gpt-5.2",
      isDefaultModel: true,
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
      modelId: "gpt-5.2",
      isDefaultModel: true,
    });
    expect(db.monthlyReviewSystemPrompt.upsert).toHaveBeenCalledWith({
      where: { id: "monthly-review-system-prompt" },
      create: {
        id: "monthly-review-system-prompt",
        promptText: "Focus on outliers and recurring merchants.",
        modelId: null,
      },
      update: {
        promptText: "Focus on outliers and recurring merchants.",
        modelId: null,
      },
      select: { promptText: true, modelId: true },
    });
  });

  it("stores empty prompt as null and falls back to default", async () => {
    const db = createSystemPromptDbMock();

    const result = await updateMonthlyReviewSystemPrompt(db, "   ");

    expect(result).toEqual({
      prompt: DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT,
      isDefault: true,
      modelId: "gpt-5.2",
      isDefaultModel: true,
    });
    expect(db.monthlyReviewSystemPrompt.upsert).toHaveBeenCalledWith({
      where: { id: "monthly-review-system-prompt" },
      create: {
        id: "monthly-review-system-prompt",
        promptText: null,
        modelId: null,
      },
      update: {
        promptText: null,
        modelId: null,
      },
      select: { promptText: true, modelId: true },
    });
  });

  it("returns settings response after update with blank prompt", async () => {
    const db = createSystemPromptDbMock("Existing prompt.");

    const result = await updateMonthlyReviewSystemPromptSettings(db, {
      promptText: " ",
      modelId: "gpt-5-mini",
    });

    expect(result).toEqual({
      storedPromptText: null,
      resolvedPrompt: DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT,
      isDefault: true,
      storedModelId: "gpt-5-mini",
      resolvedModelId: "gpt-5-mini",
      isDefaultModel: false,
    });
  });
});

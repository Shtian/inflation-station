import { MonthlyReviewStatus, PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  generateMonthlyReview,
  MonthlyReviewMonthStartValidationError,
} from "./generation";

type MonthlyReviewRow = {
  monthStart: Date;
  status: MonthlyReviewStatus;
  generatedAt: Date | null;
  errorMessage: string | null;
  reviewText: string | null;
};

function createGenerationDbMock() {
  const monthlyReviewRowByKey = new Map<string, MonthlyReviewRow>();

  const db = {
    transaction: {
      findMany: vi.fn(
        async ({ where }: { where: { bookingDate: { gte: Date } } }) => {
          const month = where.bookingDate.gte.getUTCMonth();

          if (month === 0) {
            return [];
          }

          return [
            {
              id: "tx-1",
              bookingDate: new Date("2026-02-10T12:00:00.000Z"),
              amountNok: -420,
              normalizedMerchant: "REMA 1000",
              paymentType: PaymentType.CARD,
              category: {
                id: "cat-food",
                name: "Food",
                kind: "EXPENSE",
              },
            },
          ];
        },
      ),
    },
    monthlyReviewSystemPrompt: {
      findUnique: vi.fn(async () => ({
        promptText: "Summarize spend clearly.",
        modelId: "gpt-5-mini",
      })),
    },
    monthlyReview: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { monthStart: Date };
          create: MonthlyReviewRow;
          update: Omit<MonthlyReviewRow, "monthStart">;
        }) => {
          const key = where.monthStart.toISOString();
          const existing = monthlyReviewRowByKey.get(key);

          if (existing) {
            monthlyReviewRowByKey.set(key, {
              ...existing,
              ...update,
            });
            return;
          }

          monthlyReviewRowByKey.set(key, create);
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { monthStart: Date };
          data: Omit<MonthlyReviewRow, "monthStart">;
        }) => {
          const key = where.monthStart.toISOString();
          const row = {
            monthStart: where.monthStart,
            ...data,
          };
          monthlyReviewRowByKey.set(key, row);
          return row;
        },
      ),
    },
  };

  return {
    db,
    getMonthlyReviewRow(monthStart: string) {
      return monthlyReviewRowByKey.get(`${monthStart}T00:00:00.000Z`) ?? null;
    },
  };
}

describe("generateMonthlyReview", () => {
  it("persists generated review output for the month", async () => {
    const { db, getMonthlyReviewRow } = createGenerationDbMock();

    const result = await generateMonthlyReview(
      db,
      { monthStart: "2026-02-01" },
      {
        openAiApiKey: "test-key",
        fetchImpl: vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                id: "chatcmpl-test",
                object: "chat.completion",
                created: 1_738_780_800,
                model: "gpt-4o-mini",
                choices: [
                  {
                    index: 0,
                    message: {
                      role: "assistant",
                      content: JSON.stringify({
                        reviewText:
                          "## February\nSpend increased mainly in food.",
                      }),
                    },
                    finish_reason: "stop",
                  },
                ],
                usage: {
                  prompt_tokens: 123,
                  completion_tokens: 45,
                  total_tokens: 168,
                },
              }),
              { status: 200 },
            ),
        ),
      },
    );

    expect(result.status).toBe(MonthlyReviewStatus.GENERATED);
    expect(result.unavailableReason).toBeNull();
    expect(result.reviewText).toBe(
      "## February\nSpend increased mainly in food.",
    );
    expect(result.generatedAt).not.toBeNull();
    expect(getMonthlyReviewRow("2026-02-01")?.status).toBe(
      MonthlyReviewStatus.GENERATED,
    );
  });

  it("marks month as failed when OPENAI_API_KEY is missing", async () => {
    const { db, getMonthlyReviewRow } = createGenerationDbMock();

    const result = await generateMonthlyReview(
      db,
      { monthStart: "2026-02-01" },
      { openAiApiKey: "   " },
    );

    expect(result).toEqual({
      monthStart: "2026-02-01",
      status: MonthlyReviewStatus.FAILED,
      generatedAt: null,
      errorMessage:
        "Monthly review generation is unavailable because OPENAI_API_KEY is missing.",
      reviewText: null,
      unavailableReason: "key_missing",
    });
    expect(getMonthlyReviewRow("2026-02-01")?.reviewText).toBeNull();
  });

  it("marks month as failed with provider_error for non-ok provider responses", async () => {
    const { db, getMonthlyReviewRow } = createGenerationDbMock();

    const result = await generateMonthlyReview(
      db,
      { monthStart: "2026-02-01" },
      {
        openAiApiKey: "test-key",
        fetchImpl: vi.fn(async () => new Response("{}", { status: 500 })),
      },
    );

    expect(result.status).toBe(MonthlyReviewStatus.FAILED);
    expect(result.unavailableReason).toBe("provider_error");
    expect(result.errorMessage).toBe(
      "Monthly review generation failed due to provider error.",
    );
    expect(getMonthlyReviewRow("2026-02-01")?.status).toBe(
      MonthlyReviewStatus.FAILED,
    );
  });

  it("marks month as failed with timeout when provider request aborts", async () => {
    const { db } = createGenerationDbMock();

    const result = await generateMonthlyReview(
      db,
      { monthStart: "2026-02-01" },
      {
        openAiApiKey: "test-key",
        fetchImpl: vi.fn(async () => {
          throw { name: "AbortError" };
        }),
      },
    );

    expect(result.status).toBe(MonthlyReviewStatus.FAILED);
    expect(result.unavailableReason).toBe("timeout");
    expect(result.errorMessage).toBe(
      "Monthly review generation timed out while waiting for provider response.",
    );
  });

  it("throws stable validation error for invalid monthStart", async () => {
    const { db } = createGenerationDbMock();

    await expect(
      generateMonthlyReview(db, {
        monthStart: "2026-02-20",
      }),
    ).rejects.toBeInstanceOf(MonthlyReviewMonthStartValidationError);
  });
});

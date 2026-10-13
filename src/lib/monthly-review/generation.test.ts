import { MonthlyReviewStatus, PaymentType, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  generateMonthlyReview,
  MonthlyReviewMonthStartValidationError,
} from "./generation";
import type { MonthlyRecap } from "./recap";

type MonthlyReviewRow = {
  monthStart: Date;
  status: MonthlyReviewStatus;
  generatedAt: Date | null;
  errorMessage: string | null;
  recap: Prisma.JsonValue | null;
};

type MonthlyReviewWrite = Omit<MonthlyReviewRow, "monthStart" | "recap"> & {
  recap: MonthlyRecap | typeof Prisma.DbNull;
};

// Mirrors the database: Prisma.DbNull is stored as SQL NULL.
function toStoredRow(
  monthStart: Date,
  write: MonthlyReviewWrite,
): MonthlyReviewRow {
  return {
    ...write,
    monthStart,
    recap: write.recap instanceof Prisma.NullTypes.DbNull ? null : write.recap,
  };
}

function createGenerationDbMock() {
  const monthlyReviewRowByKey = new Map<string, MonthlyReviewRow>();

  const db = {
    transaction: {
      findMany: vi.fn(
        async ({ where }: { where: { bookingDate: { gte: Date } } }) => {
          const month = where.bookingDate.gte.getMonth();

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
            {
              id: "tx-2",
              bookingDate: new Date("2026-02-15T12:00:00.000Z"),
              amountNok: 1000,
              normalizedMerchant: "EMPLOYER",
              paymentType: PaymentType.TRANSFER,
              category: {
                id: "cat-salary",
                name: "Salary",
                kind: "INCOME",
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
          create: MonthlyReviewWrite & { monthStart: Date };
          update: MonthlyReviewWrite;
        }) => {
          const key = where.monthStart.toISOString();
          const existing = monthlyReviewRowByKey.get(key);

          monthlyReviewRowByKey.set(
            key,
            toStoredRow(where.monthStart, existing ? update : create),
          );
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { monthStart: Date };
          data: MonthlyReviewWrite;
        }) => {
          const key = where.monthStart.toISOString();
          const row = toStoredRow(where.monthStart, data);
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

function createProviderFetchMock(content: unknown) {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
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
                content: JSON.stringify(content),
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
  );
}

describe("generateMonthlyReview", () => {
  it("persists generated review output for the month", async () => {
    const { db, getMonthlyReviewRow } = createGenerationDbMock();

    const fetchImpl = createProviderFetchMock({
      headline: " Februar endte i pluss med 580 kr. ",
      points: [
        "Mat hos REMA 1000 kostet 420 kr.",
        "  ",
        "Sett av overskuddet.",
      ],
    });

    const result = await generateMonthlyReview(
      db,
      { monthStart: "2026-02-01" },
      { openAiApiKey: "test-key", fetchImpl },
    );

    const requestBody = JSON.parse(
      String(fetchImpl.mock.calls[0]?.[1]?.body),
    ) as { messages: Array<{ role: string; content: string }> };
    const userPrompt = JSON.parse(
      requestBody.messages.find((message) => message.role === "user")
        ?.content ?? "{}",
    );
    expect(userPrompt.facts.cashflow).toEqual({
      incomeNok: 1000,
      spendNok: 420,
      netNok: 580,
      savingsRate: 0.58,
    });
    expect(userPrompt.facts.previousMonth).toBeNull();

    expect(result.status).toBe(MonthlyReviewStatus.GENERATED);
    expect(result.unavailableReason).toBeNull();
    expect(result.recap).toEqual({
      headline: "Februar endte i pluss med 580 kr.",
      points: ["Mat hos REMA 1000 kostet 420 kr.", "Sett av overskuddet."],
    });
    expect(result.generatedAt).not.toBeNull();
    expect(getMonthlyReviewRow("2026-02-01")).toMatchObject({
      status: MonthlyReviewStatus.GENERATED,
      recap: {
        headline: "Februar endte i pluss med 580 kr.",
        points: ["Mat hos REMA 1000 kostet 420 kr.", "Sett av overskuddet."],
      },
    });
  });

  it("marks month as failed with provider_error when the recap has no headline", async () => {
    const { db, getMonthlyReviewRow } = createGenerationDbMock();

    const result = await generateMonthlyReview(
      db,
      { monthStart: "2026-02-01" },
      {
        openAiApiKey: "test-key",
        fetchImpl: createProviderFetchMock({
          headline: "   ",
          points: ["Mat hos REMA 1000 kostet 420 kr."],
        }),
      },
    );

    expect(result).toMatchObject({
      status: MonthlyReviewStatus.FAILED,
      unavailableReason: "provider_error",
      errorMessage: "Monthly review generation failed due to provider error.",
      recap: null,
    });
    expect(getMonthlyReviewRow("2026-02-01")?.recap).toBeNull();
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
      recap: null,
      unavailableReason: "key_missing",
    });
    expect(getMonthlyReviewRow("2026-02-01")?.recap).toBeNull();
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

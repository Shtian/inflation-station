import { PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { buildMonthlyReviewGenerationInput } from "./generation-input";
import { DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT } from "./system-prompt";

function createGenerationInputDbMock(params?: {
  promptText?: string | null;
  monthTransactions?: Array<{
    id: string;
    bookingDate: Date;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: PaymentType;
    category: {
      id: string;
      name: string;
    } | null;
  }>;
  previousMonthTransactions?: Array<{
    id: string;
    bookingDate: Date;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: PaymentType;
    category: {
      id: string;
      name: string;
    } | null;
  }>;
}) {
  const monthTransactions = params?.monthTransactions ?? [];
  const previousMonthTransactions = params?.previousMonthTransactions ?? [];
  const promptText = params?.promptText ?? null;

  return {
    transaction: {
      findMany: vi.fn(
        async ({ where }: { where: { bookingDate: { gte: Date } } }) => {
          const month = where.bookingDate.gte.getUTCMonth();
          return month === 1 ? monthTransactions : previousMonthTransactions;
        },
      ),
    },
    monthlyReviewSystemPrompt: {
      findUnique: vi.fn(async () =>
        promptText === null ? null : { promptText },
      ),
    },
  };
}

describe("buildMonthlyReviewGenerationInput", () => {
  it("builds prompt, transactions payload, and precomputed metrics for a month", async () => {
    const db = createGenerationInputDbMock({
      promptText: "Focus on major spending shifts.",
      monthTransactions: [
        {
          id: "tx-feb-1",
          bookingDate: new Date("2026-02-02T10:00:00.000Z"),
          amountNok: -700,
          normalizedMerchant: "REMA 1000",
          paymentType: PaymentType.CARD,
          category: { id: "cat-food", name: "Food" },
        },
        {
          id: "tx-feb-2",
          bookingDate: new Date("2026-02-04T10:00:00.000Z"),
          amountNok: -300,
          normalizedMerchant: "REMA 1000",
          paymentType: PaymentType.CARD,
          category: { id: "cat-food", name: "Food" },
        },
        {
          id: "tx-feb-3",
          bookingDate: new Date("2026-02-08T10:00:00.000Z"),
          amountNok: -500,
          normalizedMerchant: "VY",
          paymentType: PaymentType.CARD,
          category: { id: "cat-travel", name: "Travel" },
        },
        {
          id: "tx-feb-4",
          bookingDate: new Date("2026-02-10T10:00:00.000Z"),
          amountNok: 34000,
          normalizedMerchant: "EMPLOYER",
          paymentType: PaymentType.TRANSFER,
          category: { id: "cat-income", name: "Income" },
        },
      ],
      previousMonthTransactions: [
        {
          id: "tx-jan-1",
          bookingDate: new Date("2026-01-10T10:00:00.000Z"),
          amountNok: -1000,
          normalizedMerchant: "REMA 1000",
          paymentType: PaymentType.CARD,
          category: { id: "cat-food", name: "Food" },
        },
      ],
    });

    const result = await buildMonthlyReviewGenerationInput(db, {
      monthStart: "2026-02-01",
    });

    expect(result).toEqual({
      monthStart: "2026-02-01",
      systemPrompt: "Focus on major spending shifts.",
      usesDefaultPrompt: false,
      metrics: {
        monthlyTotals: {
          totalSpendNok: 1500,
          spendTransactionCount: 3,
        },
        categoryTotals: [
          {
            categoryId: "cat-food",
            categoryName: "Food",
            spendNok: 1000,
            spendShare: 1000 / 1500,
            transactionCount: 2,
          },
          {
            categoryId: "cat-travel",
            categoryName: "Travel",
            spendNok: 500,
            spendShare: 500 / 1500,
            transactionCount: 1,
          },
        ],
        merchantConcentration: {
          topMerchants: [
            {
              normalizedMerchant: "REMA 1000",
              spendNok: 1000,
              spendShare: 1000 / 1500,
              transactionCount: 2,
            },
            {
              normalizedMerchant: "VY",
              spendNok: 500,
              spendShare: 500 / 1500,
              transactionCount: 1,
            },
          ],
          top3SpendShare: 1,
          top5SpendShare: 1,
          uniqueMerchantCount: 2,
        },
        monthOverMonth: {
          previousMonthStart: "2026-01-01",
          previousMonthTotalSpendNok: 1000,
          spendDeltaNok: 500,
          spendDeltaPercent: 0.5,
        },
      },
      transactions: [
        {
          bookingDate: "2026-02-02",
          amountNok: -700,
          normalizedMerchant: "REMA 1000",
          paymentType: PaymentType.CARD,
          categoryName: "Food",
        },
        {
          bookingDate: "2026-02-04",
          amountNok: -300,
          normalizedMerchant: "REMA 1000",
          paymentType: PaymentType.CARD,
          categoryName: "Food",
        },
        {
          bookingDate: "2026-02-08",
          amountNok: -500,
          normalizedMerchant: "VY",
          paymentType: PaymentType.CARD,
          categoryName: "Travel",
        },
        {
          bookingDate: "2026-02-10",
          amountNok: 34000,
          normalizedMerchant: "EMPLOYER",
          paymentType: PaymentType.TRANSFER,
          categoryName: "Income",
        },
      ],
    });
  });

  it("uses default system prompt and omits month-over-month metrics when prior month has no rows", async () => {
    const db = createGenerationInputDbMock({
      monthTransactions: [
        {
          id: "tx-feb-1",
          bookingDate: new Date("2026-02-02T10:00:00.000Z"),
          amountNok: -200,
          normalizedMerchant: "",
          paymentType: PaymentType.CARD,
          category: null,
        },
      ],
      previousMonthTransactions: [],
    });

    const result = await buildMonthlyReviewGenerationInput(db, {
      monthStart: "2026-02-01",
    });

    expect(result.systemPrompt).toBe(DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT);
    expect(result.usesDefaultPrompt).toBe(true);
    expect(result.metrics.monthOverMonth).toBeNull();
    expect(result.metrics.categoryTotals).toEqual([
      {
        categoryId: null,
        categoryName: "Uncategorized",
        spendNok: 200,
        spendShare: 1,
        transactionCount: 1,
      },
    ]);
    expect(result.metrics.merchantConcentration.topMerchants).toEqual([
      {
        normalizedMerchant: "Unknown merchant",
        spendNok: 200,
        spendShare: 1,
        transactionCount: 1,
      },
    ]);
  });

  it("throws stable error for invalid monthStart input", async () => {
    const db = createGenerationInputDbMock();

    await expect(
      buildMonthlyReviewGenerationInput(db, {
        monthStart: "2026-02-15",
      }),
    ).rejects.toThrow("MONTH_START_INVALID");
  });
});

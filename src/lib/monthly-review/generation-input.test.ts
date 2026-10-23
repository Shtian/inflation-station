import { PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vite-plus/test";
import { buildMonthlyReviewGenerationInput } from "./generation-input";
import { DEFAULT_MONTHLY_REVIEW_SYSTEM_PROMPT } from "./system-prompt";

function createGenerationInputDbMock(params?: {
  promptText?: string | null;
  modelId?: string | null;
  monthTransactions?: Array<{
    id: string;
    bookingDate: Date;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: PaymentType;
    category: {
      id: string;
      name: string;
      kind: string;
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
      kind: string;
    } | null;
  }>;
}) {
  const monthTransactions = params?.monthTransactions ?? [];
  const previousMonthTransactions = params?.previousMonthTransactions ?? [];
  const promptText = params?.promptText ?? null;
  const modelId = params?.modelId ?? null;

  return {
    transaction: {
      findMany: vi.fn(
        async ({ where }: { where: { bookingDate: { gte: Date } } }) => {
          const month = where.bookingDate.gte.getMonth();
          return month === 1 ? monthTransactions : previousMonthTransactions;
        },
      ),
    },
    monthlyReviewSystemPrompt: {
      findUnique: vi.fn(async () =>
        promptText === null && modelId === null
          ? null
          : { promptText, modelId },
      ),
    },
  };
}

function februaryDailySpend(
  byDate: Record<string, { spendNok: number; transactionCount: number }>,
) {
  return Array.from({ length: 28 }, (_, index) => {
    const date = `2026-02-${`${index + 1}`.padStart(2, "0")}`;
    return { date, ...(byDate[date] ?? { spendNok: 0, transactionCount: 0 }) };
  });
}

describe("buildMonthlyReviewGenerationInput", () => {
  it("builds prompt, transactions payload, and month-in-review facts for a month", async () => {
    const db = createGenerationInputDbMock({
      promptText: "Focus on major spending shifts.",
      monthTransactions: [
        {
          id: "tx-feb-1",
          bookingDate: new Date("2026-02-02T10:00:00.000Z"),
          amountNok: -700,
          normalizedMerchant: "REMA 1000",
          paymentType: PaymentType.CARD,
          category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
        },
        {
          id: "tx-feb-2",
          bookingDate: new Date("2026-02-04T10:00:00.000Z"),
          amountNok: -300,
          normalizedMerchant: "REMA 1000",
          paymentType: PaymentType.CARD,
          category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
        },
        {
          id: "tx-feb-3",
          bookingDate: new Date("2026-02-08T10:00:00.000Z"),
          amountNok: -500,
          normalizedMerchant: "VY",
          paymentType: PaymentType.CARD,
          category: { id: "cat-travel", name: "Travel", kind: "EXPENSE" },
        },
        {
          id: "tx-feb-4",
          bookingDate: new Date("2026-02-10T10:00:00.000Z"),
          amountNok: 34000,
          normalizedMerchant: "EMPLOYER",
          paymentType: PaymentType.TRANSFER,
          category: { id: "cat-income", name: "Income", kind: "INCOME" },
        },
      ],
      previousMonthTransactions: [
        {
          id: "tx-jan-1",
          bookingDate: new Date("2026-01-10T10:00:00.000Z"),
          amountNok: -1000,
          normalizedMerchant: "REMA 1000",
          paymentType: PaymentType.CARD,
          category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
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
      modelId: "gpt-6-luna",
      usesDefaultModel: true,
      facts: {
        monthStart: "2026-02-01",
        cashflow: {
          incomeNok: 34000,
          spendNok: 1500,
          netNok: 32500,
          savingsRate: 32500 / 34000,
        },
        previousMonth: {
          monthStart: "2026-01-01",
          incomeNok: 0,
          spendNok: 1000,
          netNok: -1000,
        },
        spendTransactionCount: 3,
        categories: [
          {
            categoryId: "cat-food",
            categoryName: "Food",
            spendNok: 1000,
            share: 1000 / 1500,
            transactionCount: 2,
            deltaNok: 0,
          },
          {
            categoryId: "cat-travel",
            categoryName: "Travel",
            spendNok: 500,
            share: 500 / 1500,
            transactionCount: 1,
            deltaNok: 500,
          },
        ],
        incomeSources: [{ source: "EMPLOYER", amountNok: 34000 }],
        bills: { totalNok: 0, count: 0, items: [] },
        everyday: {
          totalNok: 1500,
          count: 3,
          topMerchants: [
            {
              merchant: "REMA 1000",
              spendNok: 1000,
              share: 1000 / 1500,
              transactionCount: 2,
            },
            {
              merchant: "VY",
              spendNok: 500,
              share: 500 / 1500,
              transactionCount: 1,
            },
          ],
          biggestPurchase: {
            bookingDate: "2026-02-02",
            merchant: "REMA 1000",
            amountNok: 700,
            categoryName: "Food",
          },
          busiestDay: {
            bookingDate: "2026-02-02",
            spendNok: 700,
            transactionCount: 1,
          },
          dailySpend: februaryDailySpend({
            "2026-02-02": { spendNok: 700, transactionCount: 1 },
            "2026-02-04": { spendNok: 300, transactionCount: 1 },
            "2026-02-08": { spendNok: 500, transactionCount: 1 },
          }),
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

  it("uses default system prompt and omits previous-month facts when prior month has no rows", async () => {
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
    expect(result.modelId).toBe("gpt-6-luna");
    expect(result.usesDefaultModel).toBe(true);
    expect(result.facts.previousMonth).toBeNull();
    expect(result.facts.categories).toEqual([
      {
        categoryId: null,
        categoryName: "Ukategorisert",
        spendNok: 200,
        share: 1,
        transactionCount: 1,
        deltaNok: null,
      },
    ]);
    expect(result.facts.everyday.topMerchants).toEqual([
      {
        merchant: "Ukjent brukersted",
        spendNok: 200,
        share: 1,
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

  it("excludes transfer-category spend from facts while keeping non-transfer and uncategorized spend", async () => {
    const db = createGenerationInputDbMock({
      monthTransactions: [
        {
          id: "tx-feb-transfer",
          bookingDate: new Date("2026-02-03T10:00:00.000Z"),
          amountNok: -450,
          normalizedMerchant: "TRANSFER OUT",
          paymentType: PaymentType.TRANSFER,
          category: { id: "cat-transfer", name: "Transfer", kind: "TRANSFER" },
        },
        {
          id: "tx-feb-grocery",
          bookingDate: new Date("2026-02-04T10:00:00.000Z"),
          amountNok: -300,
          normalizedMerchant: "REMA 1000",
          paymentType: PaymentType.CARD,
          category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
        },
        {
          id: "tx-feb-uncategorized",
          bookingDate: new Date("2026-02-05T10:00:00.000Z"),
          amountNok: -200,
          normalizedMerchant: "UNKNOWN",
          paymentType: PaymentType.CARD,
          category: null,
        },
      ],
      previousMonthTransactions: [
        {
          id: "tx-jan-transfer",
          bookingDate: new Date("2026-01-06T10:00:00.000Z"),
          amountNok: -100,
          normalizedMerchant: "TRANSFER OUT",
          paymentType: PaymentType.TRANSFER,
          category: { id: "cat-transfer", name: "Transfer", kind: "TRANSFER" },
        },
        {
          id: "tx-jan-grocery",
          bookingDate: new Date("2026-01-07T10:00:00.000Z"),
          amountNok: -400,
          normalizedMerchant: "REMA 1000",
          paymentType: PaymentType.CARD,
          category: { id: "cat-food", name: "Food", kind: "EXPENSE" },
        },
      ],
    });

    const result = await buildMonthlyReviewGenerationInput(db, {
      monthStart: "2026-02-01",
    });

    expect(result.facts.cashflow).toEqual({
      incomeNok: 0,
      spendNok: 500,
      netNok: -500,
      savingsRate: null,
    });
    expect(result.facts.spendTransactionCount).toBe(2);
    expect(result.facts.categories).toEqual([
      {
        categoryId: "cat-food",
        categoryName: "Food",
        spendNok: 300,
        share: 0.6,
        transactionCount: 1,
        deltaNok: -100,
      },
      {
        categoryId: null,
        categoryName: "Ukategorisert",
        spendNok: 200,
        share: 0.4,
        transactionCount: 1,
        deltaNok: 200,
      },
    ]);
    expect(result.facts.everyday.topMerchants).toEqual([
      {
        merchant: "REMA 1000",
        spendNok: 300,
        share: 0.6,
        transactionCount: 1,
      },
      {
        merchant: "UNKNOWN",
        spendNok: 200,
        share: 0.4,
        transactionCount: 1,
      },
    ]);
    expect(result.facts.previousMonth).toEqual({
      monthStart: "2026-01-01",
      incomeNok: 0,
      spendNok: 400,
      netNok: -400,
    });
  });
});

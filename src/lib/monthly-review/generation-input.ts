import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import type { PaymentType } from "@prisma/client";
import {
  buildMonthInReview,
  type MonthInReview,
  toLocalIsoDate,
  toMonthWindow,
} from "./month-in-review";
import { getMonthlyReviewSystemPrompt } from "./system-prompt";

type DecimalLike = { toString(): string } | number;

type MonthlyReviewGenerationTransactionRecord = {
  id: string;
  bookingDate: Date;
  amountNok: DecimalLike;
  normalizedMerchant: string;
  paymentType: PaymentType;
  category: {
    id: string;
    name: string;
    kind: string;
  } | null;
};

type MonthlyReviewGenerationDbClient = {
  transaction: {
    findMany(args: {
      where: {
        bookingDate: {
          gte: Date;
          lt: Date;
        };
      };
      select: {
        id: true;
        bookingDate: true;
        amountNok: true;
        normalizedMerchant: true;
        paymentType: true;
        category: {
          select: {
            id: true;
            name: true;
            kind: true;
          };
        };
      };
      orderBy: [{ bookingDate: "asc" }, { id: "asc" }];
    }): Promise<MonthlyReviewGenerationTransactionRecord[]>;
  };
  monthlyReviewSystemPrompt: {
    findUnique(args: {
      where: {
        id: string;
      };
      select: {
        promptText: true;
        modelId: true;
      };
    }): Promise<{ promptText: string | null; modelId: string | null } | null>;
  };
};

export type MonthlyReviewGenerationTransaction = {
  bookingDate: string;
  amountNok: number;
  normalizedMerchant: string;
  paymentType: PaymentType;
  categoryName: string | null;
};

export type MonthlyReviewGenerationInput = {
  monthStart: string;
  systemPrompt: string;
  usesDefaultPrompt: boolean;
  modelId: OpenAIChatModelId;
  usesDefaultModel: boolean;
  facts: MonthInReview;
  transactions: MonthlyReviewGenerationTransaction[];
};

function toNumber(value: DecimalLike): number {
  return Number.parseFloat(value.toString());
}

export async function buildMonthlyReviewGenerationInput(
  db: MonthlyReviewGenerationDbClient,
  params: {
    monthStart: string;
  },
): Promise<MonthlyReviewGenerationInput> {
  const {
    monthStart,
    monthStartDate,
    nextMonthStartDate,
    previousMonthStartDate,
  } = toMonthWindow(params.monthStart);

  const [promptResult, monthTransactions, previousMonthTransactions] =
    await Promise.all([
      getMonthlyReviewSystemPrompt(db),
      db.transaction.findMany({
        where: {
          bookingDate: {
            gte: monthStartDate,
            lt: nextMonthStartDate,
          },
        },
        select: {
          id: true,
          bookingDate: true,
          amountNok: true,
          normalizedMerchant: true,
          paymentType: true,
          category: {
            select: {
              id: true,
              name: true,
              kind: true,
            },
          },
        },
        orderBy: [{ bookingDate: "asc" }, { id: "asc" }],
      }),
      db.transaction.findMany({
        where: {
          bookingDate: {
            gte: previousMonthStartDate,
            lt: monthStartDate,
          },
        },
        select: {
          id: true,
          bookingDate: true,
          amountNok: true,
          normalizedMerchant: true,
          paymentType: true,
          category: {
            select: {
              id: true,
              name: true,
              kind: true,
            },
          },
        },
        orderBy: [{ bookingDate: "asc" }, { id: "asc" }],
      }),
    ]);

  return {
    monthStart,
    systemPrompt: promptResult.prompt,
    usesDefaultPrompt: promptResult.isDefault,
    modelId: promptResult.modelId,
    usesDefaultModel: promptResult.isDefaultModel,
    facts: buildMonthInReview({
      monthStart,
      monthTransactions,
      previousMonthTransactions,
    }),
    transactions: monthTransactions.map((transaction) => ({
      bookingDate: toLocalIsoDate(transaction.bookingDate),
      amountNok: toNumber(transaction.amountNok),
      normalizedMerchant: transaction.normalizedMerchant,
      paymentType: transaction.paymentType,
      categoryName: transaction.category?.name ?? null,
    })),
  };
}

import type { PrismaClient } from "@prisma/client";
import { parseIsoDate } from "@/lib/iso-date";
import {
  getMonthInReview as loadMonthInReview,
  type MonthInReview,
} from "@/lib/monthly-review/month-in-review";
import { type SearchTransactionsInput, searchTransactions } from "./search";
import { type SummarizeSpendingInput, summarizeSpending } from "./spending";

export function createAssistantQueries({ db }: { db: PrismaClient }) {
  async function getMonthInReview({
    month,
  }: {
    month: string;
  }): Promise<MonthInReview & { month: string }> {
    if (!parseIsoDate(`${month}-01`)) {
      throw new Error(`Ugyldig måned "${month}". Bruk formen YYYY-MM.`);
    }
    const review = await loadMonthInReview(db, { monthStart: `${month}-01` });
    return { month, ...review };
  }

  function listCategories() {
    return db.category.findMany({
      select: { id: true, name: true, kind: true },
      orderBy: { name: "asc" },
    });
  }

  function listAccounts() {
    return db.account.findMany({
      select: { id: true, name: true, institution: true, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  return {
    summarizeSpending: (input: SummarizeSpendingInput) =>
      summarizeSpending(db, input),
    searchTransactions: (input: SearchTransactionsInput) =>
      searchTransactions(db, input),
    getMonthInReview,
    listCategories,
    listAccounts,
  };
}

import type { PrismaClient } from "@prisma/client";
import { tool } from "ai";
import { toLocalIsoDate } from "@/lib/monthly-review/month-in-review";
import {
  ONBOARDING_AGENT_MODEL,
  resolveOnboardingDisabledReason,
} from "@/lib/onboarding/agent";
import {
  emptyInputSchema,
  getMonthInReviewInputSchema,
  searchTransactionsInputSchema,
  summarizeSpendingInputSchema,
} from "./contract";
import { createAssistantQueries } from "./queries";

export const ASSISTANT_AGENT_MODEL = ONBOARDING_AGENT_MODEL;

export const resolveAssistantDisabledReason = resolveOnboardingDisabledReason;

export function buildAssistantSystemPrompt({ today }: { today: Date }): string {
  return `You are the assistant inside Inflation Station, a personal-finance app that imports bank statements and sorts transactions into categories. You answer the user's questions about their own spending and income.

Today is ${toLocalIsoDate(today)}. Resolve relative periods such as "forrige måned" or "i år" to exact dates from today.

How to work:
- Reply in Norwegian Bokmål. Keep replies short; the user is not a developer.
- Answer only from tool results. Never invent numbers or compute totals yourself; call summarizeSpending for any total.
- Amounts are NOK.
- Spend is reported as a positive number and excludes transfers between the user's own accounts.
- Dates are the user's local calendar days, and both from and to are inclusive.
- Category names are Norwegian. Call listCategories before filtering by category, and use the ids it returns. Do the same with listAccounts before filtering by account.
- State the date range the tool result echoes, so the user can see which period the answer covers.
- If a tool returns an error, read it, fix the input, and try again. If the data cannot answer the question, say so.
- You cannot change any data. If the user asks you to, explain that they can do it on the transactions or categories pages.`;
}

export function createAssistantTools({ db }: { db: PrismaClient }) {
  const queries = createAssistantQueries({ db });
  return {
    summarizeSpending: tool({
      description:
        "Total spend in NOK for an inclusive local date range, grouped by category, merchant, month, or account. Optionally filter by category ids, account ids, or a merchant search. Transfers and incoming money are excluded.",
      inputSchema: summarizeSpendingInputSchema,
      execute: (input) => queries.summarizeSpending(input),
    }),
    searchTransactions: tool({
      description:
        "List individual transactions, newest first, optionally filtered by an inclusive local date range, category id, account id, or a text search on merchant, note, and category name. Use it to show examples, not to compute totals.",
      inputSchema: searchTransactionsInputSchema,
      execute: (input) => queries.searchTransactions(input),
    }),
    getMonthInReview: tool({
      description:
        "Facts for one calendar month: income, spend by category, bills versus everyday spend, top merchants, and a comparison with the previous month.",
      inputSchema: getMonthInReviewInputSchema,
      execute: (input) => queries.getMonthInReview(input),
    }),
    listCategories: tool({
      description: "List every category with its id, name, and kind.",
      inputSchema: emptyInputSchema,
      execute: () => queries.listCategories(),
    }),
    listAccounts: tool({
      description:
        "List every account with its id, name, institution, and whether it is active.",
      inputSchema: emptyInputSchema,
      execute: () => queries.listAccounts(),
    }),
  };
}

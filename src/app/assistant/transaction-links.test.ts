import { describe, expect, it } from "vitest";
import type { AssistantUIMessage } from "@/lib/assistant/contract";
import type { SearchTransactionsInput } from "@/lib/assistant/search";
import type { SummarizeSpendingInput } from "@/lib/assistant/spending";
import { deriveTransactionLinks } from "./transaction-links";

type Part = AssistantUIMessage["parts"][number];

let callCount = 0;
function nextCallId() {
  callCount += 1;
  return `call-${callCount}`;
}

function assistantMessage(...parts: Part[]): AssistantUIMessage {
  return { id: "msg-1", role: "assistant", parts };
}

function text(value: string): Part {
  return { type: "text", text: value, state: "done" };
}

function searchTransactions(input: SearchTransactionsInput): Part {
  return {
    type: "tool-searchTransactions",
    toolCallId: nextCallId(),
    state: "output-available",
    input,
    output: {
      range: { from: input.from ?? null, to: input.to ?? null },
      filters: {
        categoryId: input.categoryId ?? null,
        accountId: input.accountId ?? null,
        query: input.query ?? null,
      },
      limit: 25,
      total: 0,
      truncated: false,
      transactions: [],
    },
  };
}

function summarizeSpending(
  input: Omit<SummarizeSpendingInput, "groupBy">,
): Part {
  return {
    type: "tool-summarizeSpending",
    toolCallId: nextCallId(),
    state: "output-available",
    input: { groupBy: "category", ...input },
    output: {
      range: { from: input.from, to: input.to },
      filters: {
        categoryIds: input.categoryIds ?? [],
        accountIds: input.accountIds ?? [],
        merchantQuery: input.merchantQuery ?? null,
      },
      groupBy: "category",
      totalSpendNok: 0,
      transactionCount: 0,
      groups: [],
    },
  };
}

function getMonthInReview(month: string): Part {
  return {
    type: "tool-getMonthInReview",
    toolCallId: nextCallId(),
    state: "output-available",
    input: { month },
    output: {
      month,
      monthStart: `${month}-01`,
      cashflow: { incomeNok: 0, spendNok: 0, netNok: 0, savingsRate: null },
      previousMonth: null,
      spendTransactionCount: 0,
      categories: [],
      incomeSources: [],
      bills: { totalNok: 0, count: 0, items: [] },
      everyday: {
        totalNok: 0,
        count: 0,
        topMerchants: [],
        biggestPurchase: null,
        busiestDay: null,
        dailySpend: [],
      },
    },
  };
}

function listCategories(categories: Array<{ id: string; name: string }>): Part {
  return {
    type: "tool-listCategories",
    toolCallId: nextCallId(),
    state: "output-available",
    input: {},
    output: categories.map((category) => ({ ...category, kind: "EXPENSE" })),
  };
}

function listAccounts(accounts: Array<{ id: string; name: string }>): Part {
  return {
    type: "tool-listAccounts",
    toolCallId: nextCallId(),
    state: "output-available",
    input: {},
    output: accounts.map((account) => ({
      ...account,
      institution: "DNB",
      isActive: true,
    })),
  };
}

describe("deriveTransactionLinks", () => {
  it("links a transaction search with every filter it used", () => {
    const message = assistantMessage(
      listCategories([{ id: "cat-food", name: "Dagligvarer" }]),
      searchTransactions({
        from: "2026-09-01",
        to: "2026-09-30",
        categoryId: "cat-food",
        accountId: "acc-1",
        query: "rema 1000",
      }),
      text("Her er kjøpene dine."),
    );

    expect(deriveTransactionLinks(message)).toEqual([
      {
        href: "/transactions?page=1&pageSize=25&globalQuery=rema+1000&dateFrom=2026-09-01&dateTo=2026-09-30&accountId=acc-1&categoryId=cat-food",
        label: "Se transaksjonene · Dagligvarer · 1.–30. sep. 2026",
      },
    ]);
  });

  it("names the account when the search has no category", () => {
    const message = assistantMessage(
      listAccounts([{ id: "acc-1", name: "Brukskonto" }]),
      searchTransactions({ from: "2026-09-01", accountId: "acc-1" }),
    );

    expect(deriveTransactionLinks(message)).toEqual([
      {
        href: "/transactions?page=1&pageSize=25&dateFrom=2026-09-01&accountId=acc-1",
        label: "Se transaksjonene · Brukskonto · fra 1. sep. 2026",
      },
    ]);
  });

  it("leaves out the name and range it does not know", () => {
    const message = assistantMessage(
      searchTransactions({ to: "2026-09-30", categoryId: "cat-unknown" }),
      searchTransactions({ query: "kiwi" }),
    );

    expect(deriveTransactionLinks(message)).toEqual([
      {
        href: "/transactions?page=1&pageSize=25&dateTo=2026-09-30&categoryId=cat-unknown",
        label: "Se transaksjonene · til 30. sep. 2026",
      },
      {
        href: "/transactions?page=1&pageSize=25&globalQuery=kiwi",
        label: "Se transaksjonene",
      },
    ]);
  });

  it("labels a search on uncategorized transactions as Ukategorisert", () => {
    const message = assistantMessage(
      searchTransactions({
        from: "2026-09-01",
        to: "2026-09-30",
        categoryId: "__uncategorized__",
      }),
    );

    expect(deriveTransactionLinks(message)).toEqual([
      {
        href: "/transactions?page=1&pageSize=25&dateFrom=2026-09-01&dateTo=2026-09-30&categoryId=__uncategorized__",
        label: "Se transaksjonene · Ukategorisert · 1.–30. sep. 2026",
      },
    ]);
  });

  it("links a spending summary narrowed to one category and one account", () => {
    const message = assistantMessage(
      listCategories([{ id: "cat-food", name: "Dagligvarer" }]),
      summarizeSpending({
        from: "2026-01-15",
        to: "2026-03-02",
        categoryIds: ["cat-food"],
        accountIds: ["acc-1"],
        merchantQuery: "coop",
      }),
    );

    expect(deriveTransactionLinks(message)).toEqual([
      {
        href: "/transactions?page=1&pageSize=25&globalQuery=coop&dateFrom=2026-01-15&dateTo=2026-03-02&accountId=acc-1&categoryId=cat-food",
        label: "Se transaksjonene · Dagligvarer · 15. jan.–2. mars 2026",
      },
    ]);
  });

  it("skips spending summaries that span several categories or accounts", () => {
    const message = assistantMessage(
      summarizeSpending({
        from: "2026-09-01",
        to: "2026-09-30",
        categoryIds: ["cat-food", "cat-fun"],
      }),
      summarizeSpending({
        from: "2026-09-01",
        to: "2026-09-30",
        accountIds: ["acc-1", "acc-2"],
      }),
      summarizeSpending({ from: "2026-09-01", to: "2026-09-30" }),
    );

    expect(deriveTransactionLinks(message)).toEqual([
      {
        href: "/transactions?page=1&pageSize=25&dateFrom=2026-09-01&dateTo=2026-09-30",
        label: "Se transaksjonene · 1.–30. sep. 2026",
      },
    ]);
  });

  it("links a month in review to every day of that month", () => {
    const message = assistantMessage(
      getMonthInReview("2024-02"),
      getMonthInReview("2026-13"),
    );

    expect(deriveTransactionLinks(message)).toEqual([
      {
        href: "/transactions?page=1&pageSize=25&dateFrom=2024-02-01&dateTo=2024-02-29",
        label: "Se transaksjonene · 1.–29. feb. 2024",
      },
    ]);
  });

  it("links nothing for lookups and plain text alone", () => {
    const lookupsOnly = assistantMessage(
      listCategories([{ id: "cat-food", name: "Dagligvarer" }]),
      listAccounts([{ id: "acc-1", name: "Brukskonto" }]),
      text("Du har kategorien Dagligvarer."),
    );
    const withSearch = assistantMessage(
      ...lookupsOnly.parts,
      searchTransactions({ categoryId: "cat-food" }),
    );

    expect(deriveTransactionLinks(lookupsOnly)).toEqual([]);
    expect(deriveTransactionLinks(assistantMessage(text("Hei!")))).toEqual([]);
    expect(deriveTransactionLinks(withSearch)).toEqual([
      {
        href: "/transactions?page=1&pageSize=25&categoryId=cat-food",
        label: "Se transaksjonene · Dagligvarer",
      },
    ]);
  });

  it("only links tool calls that finished with output", () => {
    const message = assistantMessage(
      {
        type: "tool-searchTransactions",
        toolCallId: "call-pending",
        state: "input-available",
        input: { query: "pending" },
      },
      {
        type: "tool-searchTransactions",
        toolCallId: "call-failed",
        state: "output-error",
        input: { query: "failed" },
        errorText: "Ugyldig dato",
      },
      searchTransactions({ query: "done" }),
    );

    expect(deriveTransactionLinks(message)).toEqual([
      {
        href: "/transactions?page=1&pageSize=25&globalQuery=done",
        label: "Se transaksjonene",
      },
    ]);
  });

  it("collapses tool calls that lead to the same transactions", () => {
    const message = assistantMessage(
      summarizeSpending({ from: "2024-02-01", to: "2024-02-29" }),
      getMonthInReview("2024-02"),
      searchTransactions({ from: "2024-02-01", to: "2024-02-29" }),
    );

    expect(deriveTransactionLinks(message)).toEqual([
      {
        href: "/transactions?page=1&pageSize=25&dateFrom=2024-02-01&dateTo=2024-02-29",
        label: "Se transaksjonene · 1.–29. feb. 2024",
      },
    ]);
  });

  it("keeps the first three links in the order the tools ran", () => {
    const message = assistantMessage(
      searchTransactions({ query: "a" }),
      searchTransactions({ query: "b" }),
      searchTransactions({ query: "a" }),
      searchTransactions({ query: "c" }),
      searchTransactions({ query: "d" }),
    );

    expect(deriveTransactionLinks(message).map((link) => link.href)).toEqual([
      "/transactions?page=1&pageSize=25&globalQuery=a",
      "/transactions?page=1&pageSize=25&globalQuery=b",
      "/transactions?page=1&pageSize=25&globalQuery=c",
    ]);
  });
});

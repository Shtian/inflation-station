import { PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { OpenAiCategorizationSuggestion } from "../categorization/openai-suggestions";
import type { CategoryRuleCandidate } from "../categorization/rule-engine";
import {
  AccountNotFoundError,
  importTransactionsFromCsv,
} from "./import-transactions";

const HEADER =
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype";

function createDbMock(options?: {
  accountExists?: boolean;
  categories?: Array<{
    id: string;
    name: string;
    kind: "EXPENSE" | "INCOME" | "TRANSFER";
  }>;
  existingTransactions?: Array<{
    bookingDate: Date;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: PaymentType;
  }>;
}) {
  return {
    account: {
      findUnique: vi.fn(async () =>
        options?.accountExists === false ? null : { id: "account-1" },
      ),
    },
    categoryRule: {
      findMany: vi.fn<() => Promise<CategoryRuleCandidate[]>>(async () => []),
    },
    category: {
      findMany: vi.fn(async () => options?.categories ?? []),
    },
    transaction: {
      findMany: vi.fn(async () => options?.existingTransactions ?? []),
      createMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async ({ data }) => ({
        id: "tx-created-1",
        normalizedMerchant: data.normalizedMerchant,
        paymentType: data.paymentType,
      })),
    },
    categorizationSuggestion: {
      createMany: vi.fn(async () => ({ count: 0 })),
    },
  };
}

describe("importTransactionsFromCsv", () => {
  it("throws AccountNotFoundError when the selected account does not exist", async () => {
    const db = createDbMock({ accountExists: false });

    await expect(
      importTransactionsFromCsv(db, {
        accountId: "missing-account",
        csvContent: `${HEADER}\n01.01.2026;10,00;A;B;C;D;NOK;Kort`,
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);

    expect(db.transaction.findMany).not.toHaveBeenCalled();
    expect(db.transaction.create).not.toHaveBeenCalled();
  });

  it("returns parser diagnostics and skips DB writes when all rows are invalid", async () => {
    const db = createDbMock();

    const result = await importTransactionsFromCsv(db, {
      accountId: "account-1",
      csvContent: "",
    });

    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    });
    expect(result.errors).toHaveLength(1);
    expect(db.transaction.findMany).not.toHaveBeenCalled();
    expect(db.transaction.create).not.toHaveBeenCalled();
  });

  it("deduplicates batch and existing rows before insert and returns stable summary", async () => {
    const db = createDbMock({
      existingTransactions: [
        {
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          amountNok: 200,
          normalizedMerchant: "shop a alice groceries friday",
          paymentType: PaymentType.CARD,
        },
      ],
    });

    const csv = [
      HEADER,
      "01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
      "01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
      "03.01.2026;200,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
    ].join("\n");

    const result = await importTransactionsFromCsv(db, {
      accountId: "account-1",
      csvContent: csv,
    });

    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 2,
      ignoredReserved: 0,
      invalid: 0,
    });

    expect(db.transaction.create).toHaveBeenCalledOnce();
    expect(db.transaction.create).toHaveBeenCalledWith({
      data: {
        accountId: "account-1",
        bookingDate: new Date("2026-01-01T00:00:00.000Z"),
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant: "shop a alice groceries friday",
        paymentType: PaymentType.CARD,
      },
      select: {
        id: true,
        normalizedMerchant: true,
        paymentType: true,
      },
    });
  });

  it("preserves ignored and invalid counts from parser while importing valid rows", async () => {
    const db = createDbMock();

    const csv = [
      HEADER,
      "Reservert;10,00;A;B;C;D;NOK;Kort",
      "02.01.2026;20,00;A;B;C;D;USD;Kort",
      "03.01.2026;30,00;A;B;C;D;NOK;Kort",
    ].join("\n");

    const result = await importTransactionsFromCsv(db, {
      accountId: "account-1",
      csvContent: csv,
    });

    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 1,
      invalid: 1,
    });
  });

  it("accepts booking dates in YYYY/MM/DD format", async () => {
    const db = createDbMock();

    const result = await importTransactionsFromCsv(db, {
      accountId: "account-1",
      csvContent: `${HEADER}\n2026/02/13;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
    });

    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    });
    expect(result.errors).toHaveLength(0);
    expect(db.transaction.create).toHaveBeenCalledWith({
      data: {
        accountId: "account-1",
        bookingDate: new Date("2026-02-13T00:00:00.000Z"),
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant: "shop a alice groceries friday",
        paymentType: PaymentType.CARD,
      },
      select: {
        id: true,
        normalizedMerchant: true,
        paymentType: true,
      },
    });
  });

  it("creates rule-based suggestions for matched imported transactions", async () => {
    const db = createDbMock({
      categories: [{ id: "cat-groceries", name: "Groceries", kind: "EXPENSE" }],
    });
    db.categoryRule.findMany.mockResolvedValueOnce([
      {
        id: "rule-1",
        categoryId: "cat-groceries",
        merchantContains: "shop a",
        paymentType: PaymentType.CARD,
        priority: 10,
      },
    ]);
    db.transaction.create.mockResolvedValueOnce({
      id: "tx-1",
      normalizedMerchant: "shop a alice groceries friday",
      paymentType: PaymentType.CARD,
    });

    const result = await importTransactionsFromCsv(db, {
      accountId: "account-1",
      csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
    });

    expect(result.summary.imported).toBe(1);
    expect(db.categorizationSuggestion.createMany).toHaveBeenCalledWith({
      data: [
        {
          transactionId: "tx-1",
          suggestedCategoryId: "cat-groceries",
          source: "RULE",
          confidence: 0.95,
          reasoning: 'Matched merchant "shop a" and payment type "CARD".',
        },
      ],
    });
  });

  it("does not create suggestions when no rules match", async () => {
    const db = createDbMock({
      categories: [{ id: "cat-rent", name: "Rent", kind: "EXPENSE" }],
    });
    db.categoryRule.findMany.mockResolvedValueOnce([
      {
        id: "rule-1",
        categoryId: "cat-rent",
        merchantContains: "rent",
        paymentType: PaymentType.TRANSFER,
        priority: 10,
      },
    ]);

    await importTransactionsFromCsv(db, {
      accountId: "account-1",
      csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
    });

    expect(db.categorizationSuggestion.createMany).not.toHaveBeenCalled();
  });

  it("skips OpenAI suggestions when API key is not configured", async () => {
    const db = createDbMock({
      categories: [{ id: "cat-food", name: "Food", kind: "EXPENSE" }],
    });
    const openAiBuilder = vi.fn<
      (params: {
        apiKey: string | null | undefined;
        categories: Array<{
          id: string;
          name: string;
          kind: "EXPENSE" | "INCOME" | "TRANSFER";
        }>;
        transactions: Array<{
          id: string;
          normalizedMerchant: string;
          paymentType: PaymentType;
        }>;
      }) => Promise<OpenAiCategorizationSuggestion[]>
    >(async () => []);

    await importTransactionsFromCsv(
      db,
      {
        accountId: "account-1",
        csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
      },
      {
        openAiApiKey: null,
        buildOpenAiSuggestions: openAiBuilder,
      },
    );

    expect(openAiBuilder).toHaveBeenCalledWith({
      apiKey: null,
      categories: [{ id: "cat-food", name: "Food", kind: "EXPENSE" }],
      transactions: [
        {
          id: "tx-created-1",
          normalizedMerchant: "shop a alice groceries friday",
          paymentType: PaymentType.CARD,
        },
      ],
    });
    expect(db.categorizationSuggestion.createMany).not.toHaveBeenCalled();
  });

  it("continues import when OpenAI suggestion generation throws", async () => {
    const db = createDbMock({
      categories: [{ id: "cat-food", name: "Food", kind: "EXPENSE" }],
    });

    const result = await importTransactionsFromCsv(
      db,
      {
        accountId: "account-1",
        csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
      },
      {
        openAiApiKey: "test-key",
        buildOpenAiSuggestions: vi.fn(async () => {
          throw new Error("provider unavailable");
        }),
      },
    );

    expect(result.summary.imported).toBe(1);
    expect(db.categorizationSuggestion.createMany).not.toHaveBeenCalled();
  });

  it("persists OpenAI suggestions for unresolved imported transactions", async () => {
    const db = createDbMock({
      categories: [
        { id: "cat-food", name: "Food", kind: "EXPENSE" },
        { id: "cat-rent", name: "Rent", kind: "EXPENSE" },
      ],
    });
    const openAiBuilder = vi.fn(async () => [
      {
        transactionId: "tx-created-1",
        suggestedCategoryId: "cat-food",
        source: "OPENAI" as const,
        confidence: 0.72,
        reasoning: "Merchant resembles grocery spending.",
      },
    ]);

    await importTransactionsFromCsv(
      db,
      {
        accountId: "account-1",
        csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
      },
      {
        openAiApiKey: "test-key",
        buildOpenAiSuggestions: openAiBuilder,
      },
    );

    expect(openAiBuilder).toHaveBeenCalledOnce();
    expect(db.categorizationSuggestion.createMany).toHaveBeenCalledWith({
      data: [
        {
          transactionId: "tx-created-1",
          suggestedCategoryId: "cat-food",
          source: "OPENAI",
          confidence: 0.72,
          reasoning: "Merchant resembles grocery spending.",
        },
      ],
    });
  });
});

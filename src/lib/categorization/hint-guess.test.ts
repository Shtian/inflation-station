import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import type { CategoryProfile } from "./category-merchants";
import {
  buildHintGuessPrompt,
  generateCategoryHintGuess,
  reconcileHintGuess,
  resolveHintGuessDisabledReason,
} from "./hint-guess";

const groceries: CategoryProfile = {
  id: "groceries",
  name: "Groceries",
  kind: "EXPENSE",
  merchants: [
    { key: "rema", label: "Rema", transactionCount: 41 },
    { key: "kiwi", label: "Kiwi", transactionCount: 23 },
    { key: "coop", label: "Coop Extra", transactionCount: 9 },
  ],
};

const fuel: CategoryProfile = {
  id: "fuel",
  name: "Fuel",
  kind: "EXPENSE",
  merchants: [{ key: "circle", label: "Circle K", transactionCount: 5 }],
};

function chatCompletionResponse(content: string) {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1_738_780_800,
      model: "gpt-6-luna",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("reconcileHintGuess", () => {
  it("drops guesses already in history, duplicates, lists and blanks", () => {
    expect(
      reconcileHintGuess(
        {
          description: "Groceries and food shopping.",
          similarMerchants: [
            "Meny",
            "Rema 1000",
            "KIWI",
            "Coop Mega",
            "Bunnpris",
            "meny",
            "  Joker  ",
            "Spar, Joker",
            "",
          ],
        },
        groceries,
      ),
    ).toEqual({
      description: "Groceries and food shopping",
      merchants: [
        { key: "meny", label: "Meny" },
        { key: "bunnpris", label: "Bunnpris" },
        { key: "joker", label: "Joker" },
      ],
    });
  });

  it("keeps at most six guesses", () => {
    expect(
      reconcileHintGuess(
        {
          description: "",
          similarMerchants: [
            "Meny",
            "Bunnpris",
            "Joker",
            "Spar",
            "Extra",
            "Oda",
            "Holdbart",
          ],
        },
        groceries,
      ).merchants.map((merchant) => merchant.label),
    ).toEqual(["Meny", "Bunnpris", "Joker", "Spar", "Extra", "Oda"]);
  });

  it("keys a short brand by its core when it has no family key", () => {
    expect(
      reconcileHintGuess(
        { description: "Trains and buses", similarMerchants: ["Vy"] },
        { merchants: [] },
      ),
    ).toEqual({
      description: "Trains and buses",
      merchants: [{ key: "vy", label: "Vy" }],
    });
  });

  it("drops a description that names a merchant but keeps the guesses", () => {
    expect(
      reconcileHintGuess(
        {
          description: "Groceries from Rema and others",
          similarMerchants: ["Meny"],
        },
        groceries,
      ),
    ).toEqual({
      description: null,
      merchants: [{ key: "meny", label: "Meny" }],
    });
    expect(
      reconcileHintGuess(
        { description: "Food shopping at Meny", similarMerchants: ["Meny"] },
        groceries,
      ).description,
    ).toBeNull();
  });

  it("collapses whitespace and strips trailing punctuation from the description", () => {
    expect(
      reconcileHintGuess(
        {
          description: "  Groceries\nand   food shopping!! ",
          similarMerchants: [],
        },
        groceries,
      ),
    ).toEqual({ description: "Groceries and food shopping", merchants: [] });
  });
});

describe("buildHintGuessPrompt", () => {
  it("lists the category's history and the other categories' top merchants", () => {
    const prompt = buildHintGuessPrompt(groceries, [fuel]);

    expect(prompt).toContain(
      "Category: Groceries (EXPENSE)\nMerchants already in history: Rema, Kiwi, Coop Extra\n\nOther categories:\n- Fuel: Circle K",
    );
    expect(prompt).not.toContain("- Groceries:");
    expect(prompt).toContain("Write the description in English.");
    expect(prompt).toContain("Do not name any merchant in the description.");
  });

  it("marks an empty history", () => {
    expect(
      buildHintGuessPrompt({ ...groceries, merchants: [] }, [fuel]),
    ).toContain("Merchants already in history: (none)");
  });
});

describe("resolveHintGuessDisabledReason", () => {
  it.each([
    [{}, "key_missing"],
    [{ OPENAI_API_KEY: "  " }, "key_missing"],
    [{ OPENAI_API_KEY: "k" }, null],
    [{ OPENAI_API_KEY: "k", OPENAI_HINT_SUGGESTIONS_ENABLED: "true" }, null],
    [
      { OPENAI_API_KEY: "k", OPENAI_HINT_SUGGESTIONS_ENABLED: " FALSE " },
      "disabled",
    ],
  ])("%j is %s", (env, reason) => {
    expect(resolveHintGuessDisabledReason(env)).toBe(reason);
  });
});

describe("generateCategoryHintGuess", () => {
  let db: TestDatabase;
  let categoryId: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    const account = await db.client.account.create({
      data: { name: "Checking" },
    });
    const category = await db.client.category.create({
      data: { name: "Groceries" },
    });
    categoryId = category.id;
    await db.client.transaction.create({
      data: {
        accountId: account.id,
        categoryId,
        bookingDate: new Date("2026-03-01"),
        amountNok: -100,
        currency: "NOK",
        normalizedMerchant: "rema 1000 oslo",
        merchant: "REMA 1000 OSLO",
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await teardownTestDatabase(db);
  });

  it("returns not_found for an unknown category without calling the provider", async () => {
    const fetchImpl = vi.fn();

    await expect(
      generateCategoryHintGuess({
        db: db.client,
        categoryId: "missing",
        apiKey: "test-key",
        fetchImpl,
      }),
    ).resolves.toEqual({ status: "not_found" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a filtered guess from the provider", async () => {
    let capturedBody: { model?: string; reasoning_effort?: string } = {};
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return chatCompletionResponse(
        JSON.stringify({
          description: "Groceries and food shopping.",
          similarMerchants: ["Rema 1000", "Meny"],
        }),
      );
    });

    await expect(
      generateCategoryHintGuess({
        db: db.client,
        categoryId,
        apiKey: "test-key",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      status: "ok",
      guess: {
        description: "Groceries and food shopping",
        merchants: [{ key: "meny", label: "Meny" }],
      },
    });
    expect(capturedBody.model).toBe("gpt-6-luna");
    expect(capturedBody.reasoning_effort).toBe("low");
  });

  it("maps a provider throw to provider_error", async () => {
    await expect(
      generateCategoryHintGuess({
        db: db.client,
        categoryId,
        apiKey: "test-key",
        fetchImpl: vi.fn(async () => {
          throw new Error("network down");
        }),
      }),
    ).resolves.toEqual({ status: "failed", reason: "provider_error" });
  });

  it("maps a request that outlives the timeout to timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    );

    await expect(
      generateCategoryHintGuess({
        db: db.client,
        categoryId,
        apiKey: "test-key",
        timeoutMs: 1,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ status: "failed", reason: "timeout" });
  });
});

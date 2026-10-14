import type { Tool } from "ai";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import { buildAssistantSystemPrompt, createAssistantTools } from "./agent";
import { seedAssistantFixture } from "./test-fixture";

// Seeded bookings are stored as local midnight; pin a zone east of UTC so the
// local-day bounds are exercised the same way on every machine.
process.env.TZ = "Europe/Oslo";

// None of the tools stream, so the result is the output itself.
async function run<INPUT, OUTPUT>(
  tool: Tool<INPUT, OUTPUT>,
  input: INPUT,
): Promise<OUTPUT> {
  if (!tool.execute) {
    throw new Error("The tool has no execute function.");
  }
  return (await tool.execute(input, {
    toolCallId: "call-1",
    messages: [],
  })) as OUTPUT;
}

describe("buildAssistantSystemPrompt", () => {
  it("injects today's local date, not the UTC one", () => {
    // 00:30 in Oslo is still the previous day in UTC.
    const prompt = buildAssistantSystemPrompt({
      today: new Date(2026, 5, 1, 0, 30),
    });

    expect(prompt).toContain("2026-06-01");
    expect(prompt).not.toContain("2026-05-31");
  });
});

describe("createAssistantTools", () => {
  let db: TestDatabase;
  let tools: ReturnType<typeof createAssistantTools>;

  beforeAll(async () => {
    db = await createTestDatabase();
    tools = createAssistantTools({ db: db.client });
    await seedAssistantFixture(db.client);
  });

  afterAll(async () => {
    await teardownTestDatabase(db);
  });

  it("summarizeSpending totals spend by category", async () => {
    const summary = await run(tools.summarizeSpending, {
      from: "2026-09-01",
      to: "2026-09-30",
      groupBy: "category",
    });

    expect({
      range: summary.range,
      totalSpendNok: summary.totalSpendNok,
      groups: summary.groups.map(({ label, spendNok }) => [label, spendNok]),
    }).toEqual({
      range: { from: "2026-09-01", to: "2026-09-30" },
      totalSpendNok: 350.6,
      groups: [
        ["Ukategorisert", 200],
        ["Mat", 150.3],
        ["Reise", 0.3],
      ],
    });
  });

  it("summarizeSpending rejects a day that does not exist", async () => {
    await expect(
      run(tools.summarizeSpending, {
        from: "2026-02-30",
        to: "2026-03-01",
        groupBy: "category",
      }),
    ).rejects.toThrow(
      'Ugyldig from-dato "2026-02-30". Bruk en dag som finnes i kalenderen, på formen YYYY-MM-DD.',
    );
  });

  it("searchTransactions finds matching transactions newest first", async () => {
    const result = await run(tools.searchTransactions, {
      from: "2026-09-01",
      to: "2026-09-30",
      query: "kiwi",
    });

    expect({
      total: result.total,
      ids: result.transactions.map(({ id }) => id),
    }).toEqual({
      total: 2,
      ids: ["sep-15-uncategorized", "sep-01-utc"],
    });
  });

  it("getMonthInReview returns the month's spend", async () => {
    const review = await run(tools.getMonthInReview, { month: "2026-09" });

    expect({
      month: review.month,
      spendNok: review.cashflow.spendNok,
    }).toEqual({ month: "2026-09", spendNok: 350.6 });
  });

  it("listCategories and listAccounts return names in order", async () => {
    const categories = await run(tools.listCategories, {});
    const accounts = await run(tools.listAccounts, {});

    expect(categories.map(({ name }) => name)).toEqual([
      "Lønn",
      "Mat",
      "Overføring",
      "Reise",
    ]);
    expect(accounts.map(({ name }) => name)).toEqual([
      "Brukskonto",
      "Kredittkort",
    ]);
  });
});

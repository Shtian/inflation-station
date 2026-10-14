import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import { createAssistantQueries } from "./queries";
import { localMidnight, seedAssistantFixture } from "./test-fixture";

// Seeded bookings are stored as local midnight; pin a zone east of UTC so the
// local-day bounds are exercised the same way on every machine.
process.env.TZ = "Europe/Oslo";

describe("createAssistantQueries", () => {
  let db: TestDatabase;
  let queries: ReturnType<typeof createAssistantQueries>;

  beforeAll(async () => {
    db = await createTestDatabase();
    queries = createAssistantQueries({ db: db.client });
    await seedAssistantFixture(db.client);
  });

  afterAll(async () => {
    await teardownTestDatabase(db);
  });

  describe("searchTransactions", () => {
    it("includes transfers and echoes absent filters as null", async () => {
      const result = await queries.searchTransactions({
        accountId: "acc-main",
        query: "sparekonto",
      });

      expect(result).toEqual({
        range: { from: null, to: null },
        filters: {
          categoryId: null,
          accountId: "acc-main",
          query: "sparekonto",
        },
        limit: 25,
        total: 1,
        truncated: false,
        transactions: [
          {
            id: "sep-15-transfer",
            bookingDate: "2026-09-14",
            amountNok: -5000,
            merchant: "Sparekonto",
            categoryName: "Overføring",
            accountName: "Brukskonto",
            note: null,
          },
        ],
      });
    });

    it("falls back to the normalized merchant and filters by category", async () => {
      const result = await queries.searchTransactions({
        from: "2026-09-01",
        to: "2026-10-31",
        categoryId: "cat-travel",
      });

      expect(result.filters).toEqual({
        categoryId: "cat-travel",
        accountId: null,
        query: null,
      });
      expect(
        result.transactions.map(({ id, merchant }) => ({ id, merchant })),
      ).toEqual([
        { id: "oct-01", merchant: "Vy" },
        { id: "sep-30", merchant: "" },
      ]);
    });
  });
});

describe("searchTransactions limits and day bounds", () => {
  let db: TestDatabase;
  let queries: ReturnType<typeof createAssistantQueries>;

  beforeAll(async () => {
    db = await createTestDatabase();
    queries = createAssistantQueries({ db: db.client });

    await db.client.account.create({
      data: { id: "acc-main", name: "Brukskonto" },
    });
    await db.client.transaction.createMany({
      data: Array.from({ length: 105 }, (_, index) => ({
        id: `coffee-${index}`,
        accountId: "acc-main",
        bookingDate: localMidnight("2026-09-05"),
        amountNok: -45,
        currency: "NOK",
        merchant: "Kaffebar",
        normalizedMerchant: "kaffebar",
      })),
    });
    await db.client.transaction.createMany({
      data: [
        {
          id: "dst-late-evening",
          accountId: "acc-main",
          bookingDate: new Date(2026, 9, 25, 23, 30),
          amountNok: -10,
          currency: "NOK",
          merchant: "Narvesen",
          normalizedMerchant: "narvesen",
          note: "kveldskjøp",
        },
        {
          id: "dst-next-midnight",
          accountId: "acc-main",
          bookingDate: localMidnight("2026-10-26"),
          amountNok: -20,
          currency: "NOK",
          merchant: "Narvesen",
          normalizedMerchant: "narvesen",
        },
      ],
    });
  });

  afterAll(async () => {
    await teardownTestDatabase(db);
  });

  it("caps the page at 100 rows and reports truncation", async () => {
    const result = await queries.searchTransactions({
      query: "kaffebar",
      limit: 500,
    });

    expect({
      limit: result.limit,
      total: result.total,
      truncated: result.truncated,
      returned: result.transactions.length,
    }).toEqual({ limit: 100, total: 105, truncated: true, returned: 100 });
  });

  it("ends an inclusive day at the next local midnight across the DST change", async () => {
    const result = await queries.searchTransactions({
      from: "2026-10-25",
      to: "2026-10-25",
    });

    expect(result).toEqual({
      range: { from: "2026-10-25", to: "2026-10-25" },
      filters: { categoryId: null, accountId: null, query: null },
      limit: 25,
      total: 1,
      truncated: false,
      transactions: [
        {
          id: "dst-late-evening",
          bookingDate: "2026-10-25",
          amountNok: -10,
          merchant: "Narvesen",
          categoryName: null,
          accountName: "Brukskonto",
          note: "kveldskjøp",
        },
      ],
    });
  });
});

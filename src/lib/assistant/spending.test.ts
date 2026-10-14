import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import { createAssistantQueries } from "./queries";
import { seedAssistantFixture } from "./test-fixture";

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

  describe("summarizeSpending", () => {
    it("excludes transfers and income, keeps uncategorized spend, reports spend positive", async () => {
      const summary = await queries.summarizeSpending({
        from: "2026-09-01",
        to: "2026-09-30",
        groupBy: "category",
      });

      expect(summary).toEqual({
        range: { from: "2026-09-01", to: "2026-09-30" },
        filters: { categoryIds: [], accountIds: [], merchantQuery: null },
        groupBy: "category",
        totalSpendNok: 350.6,
        transactionCount: 4,
        groups: [
          {
            key: null,
            label: "Ukategorisert",
            spendNok: 200,
            transactionCount: 1,
          },
          {
            key: "cat-food",
            label: "Mat",
            spendNok: 150.3,
            transactionCount: 2,
          },
          {
            key: "cat-travel",
            label: "Reise",
            spendNok: 0.3,
            transactionCount: 1,
          },
        ],
      });
    });

    it.each([
      ["2026-08-31", 1000, 1],
      ["2026-09-01", 150.3, 2],
      ["2026-09-30", 0.3, 1],
      ["2026-10-01", 999, 1],
    ])("buckets bookings on %s by local calendar day", async (day, totalSpendNok, transactionCount) => {
      const summary = await queries.summarizeSpending({
        from: day,
        to: day,
        groupBy: "category",
      });

      expect({
        totalSpendNok: summary.totalSpendNok,
        transactionCount: summary.transactionCount,
      }).toEqual({ totalSpendNok, transactionCount });
    });

    it("groups by normalized merchant with blank merchants as unknown", async () => {
      const summary = await queries.summarizeSpending({
        from: "2026-09-01",
        to: "2026-09-30",
        groupBy: "merchant",
      });

      expect(summary.groups).toEqual([
        {
          key: "kiwi majorstuen",
          label: "kiwi majorstuen",
          spendNok: 250.2,
          transactionCount: 2,
        },
        {
          key: "rema 1000",
          label: "rema 1000",
          spendNok: 100.1,
          transactionCount: 1,
        },
        {
          key: null,
          label: "Ukjent brukersted",
          spendNok: 0.3,
          transactionCount: 1,
        },
      ]);
    });

    it("groups by local calendar month", async () => {
      const summary = await queries.summarizeSpending({
        from: "2026-08-01",
        to: "2026-10-31",
        groupBy: "month",
      });

      expect(summary.totalSpendNok).toBe(2349.6);
      expect(summary.groups).toEqual([
        {
          key: "2026-08",
          label: "2026-08",
          spendNok: 1000,
          transactionCount: 1,
        },
        {
          key: "2026-10",
          label: "2026-10",
          spendNok: 999,
          transactionCount: 1,
        },
        {
          key: "2026-09",
          label: "2026-09",
          spendNok: 350.6,
          transactionCount: 4,
        },
      ]);
    });

    it("groups by account", async () => {
      const summary = await queries.summarizeSpending({
        from: "2026-09-01",
        to: "2026-09-30",
        groupBy: "account",
      });

      expect(summary.groups).toEqual([
        {
          key: "acc-main",
          label: "Brukskonto",
          spendNok: 300.1,
          transactionCount: 2,
        },
        {
          key: "acc-card",
          label: "Kredittkort",
          spendNok: 50.5,
          transactionCount: 2,
        },
      ]);
    });

    it("filters by category and account and echoes the filters", async () => {
      const summary = await queries.summarizeSpending({
        from: "2026-09-01",
        to: "2026-09-30",
        groupBy: "account",
        categoryIds: ["cat-food", "cat-travel"],
        accountIds: ["acc-card"],
      });

      expect(summary).toEqual({
        range: { from: "2026-09-01", to: "2026-09-30" },
        filters: {
          categoryIds: ["cat-food", "cat-travel"],
          accountIds: ["acc-card"],
          merchantQuery: null,
        },
        groupBy: "account",
        totalSpendNok: 50.5,
        transactionCount: 2,
        groups: [
          {
            key: "acc-card",
            label: "Kredittkort",
            spendNok: 50.5,
            transactionCount: 2,
          },
        ],
      });
    });

    it("matches the merchant query against the normalized merchant key", async () => {
      const summary = await queries.summarizeSpending({
        from: "2026-09-01",
        to: "2026-09-30",
        groupBy: "category",
        merchantQuery: "  KIWI  ",
      });

      expect(summary.filters).toEqual({
        categoryIds: [],
        accountIds: [],
        merchantQuery: "KIWI",
      });
      expect(summary.groups).toEqual([
        {
          key: null,
          label: "Ukategorisert",
          spendNok: 200,
          transactionCount: 1,
        },
        {
          key: "cat-food",
          label: "Mat",
          spendNok: 50.2,
          transactionCount: 1,
        },
      ]);
    });

    it("rejects a day that does not exist", async () => {
      await expect(
        queries.summarizeSpending({
          from: "2026-02-30",
          to: "2026-03-01",
          groupBy: "category",
        }),
      ).rejects.toThrow(
        'Ugyldig from-dato "2026-02-30". Bruk en dag som finnes i kalenderen, på formen YYYY-MM-DD.',
      );
    });

    it("rejects a range whose start is after its end", async () => {
      await expect(
        queries.summarizeSpending({
          from: "2026-09-02",
          to: "2026-09-01",
          groupBy: "category",
        }),
      ).rejects.toThrow(
        "Ugyldig periode: from (2026-09-02) er etter to (2026-09-01).",
      );
    });
  });
});

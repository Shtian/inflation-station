import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
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

  describe("getMonthInReview", () => {
    it("returns the requested month's facts with the month echoed", async () => {
      const review = await queries.getMonthInReview({ month: "2026-09" });

      expect({
        month: review.month,
        monthStart: review.monthStart,
        incomeNok: review.cashflow.incomeNok,
        spendNok: review.cashflow.spendNok,
        previousMonthSpendNok: review.previousMonth?.spendNok,
      }).toEqual({
        month: "2026-09",
        monthStart: "2026-09-01",
        incomeNok: 30040,
        spendNok: 350.6,
        previousMonthSpendNok: 1000,
      });
    });

    it("rejects a month that is not YYYY-MM", async () => {
      await expect(
        queries.getMonthInReview({ month: "2026-13" }),
      ).rejects.toThrow('Ugyldig måned "2026-13". Bruk formen YYYY-MM.');
    });
  });

  describe("listCategories and listAccounts", () => {
    it("lists categories by name", async () => {
      expect(await queries.listCategories()).toEqual([
        { id: "cat-salary", name: "Lønn", kind: "INCOME" },
        { id: "cat-food", name: "Mat", kind: "EXPENSE" },
        { id: "cat-transfer", name: "Overføring", kind: "TRANSFER" },
        { id: "cat-travel", name: "Reise", kind: "EXPENSE" },
      ]);
    });

    it("lists accounts by name", async () => {
      expect(await queries.listAccounts()).toEqual([
        {
          id: "acc-main",
          name: "Brukskonto",
          institution: "DNB",
          isActive: true,
        },
        {
          id: "acc-card",
          name: "Kredittkort",
          institution: null,
          isActive: false,
        },
      ]);
    });
  });
});

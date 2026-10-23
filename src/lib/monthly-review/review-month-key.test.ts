import { readFileSync } from "node:fs";
import path from "node:path";
import { MonthlyReviewStatus } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import { getMonthInReviewWithReview } from "./month-in-review";
import { getMonthlyTimeline } from "./timeline";

const ORIGINAL_TZ = process.env.TZ;

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase(db);
});

afterEach(async () => {
  process.env.TZ = ORIGINAL_TZ;
  await db.client.monthlyReview.deleteMany();
});

async function reviewStatesFor(monthStart: string) {
  const timeline = await getMonthlyTimeline(db.client);
  const deck = await getMonthInReviewWithReview(db.client, { monthStart });
  return {
    timeline: timeline.map((row) => [row.monthStart, row.reviewState]),
    deck: deck.reviewState,
  };
}

describe.each(["Europe/Oslo", "America/New_York"])(
  "MonthlyReview month key in %s",
  (timeZone) => {
    it("shows a UTC-keyed review on the same month in the timeline and the deck", async () => {
      process.env.TZ = timeZone;
      await db.client.monthlyReview.create({
        data: {
          monthStart: new Date("2026-09-01T00:00:00.000Z"),
          status: MonthlyReviewStatus.GENERATED,
          recap: { headline: "September recap.", points: [] },
        },
      });

      expect(await reviewStatesFor("2026-09-01")).toEqual({
        timeline: [["2026-09-01", "GENERATED"]],
        deck: "GENERATED",
      });
    });
  },
);

describe("normalize_monthly_review_month_start migration", () => {
  it("moves a local-midnight row to the UTC first of its month", async () => {
    process.env.TZ = "Europe/Oslo";
    await db.client.$executeRawUnsafe(
      `INSERT INTO "MonthlyReview" ("id", "monthStart", "status", "createdAt", "updatedAt")
       VALUES ('legacy', '2026-08-31T22:00:00.000+00:00', 'GENERATED', '2026-10-10T00:00:00.000+00:00', '2026-10-10T00:00:00.000+00:00')`,
    );
    const migration = readFileSync(
      path.resolve(
        __dirname,
        "../../../prisma/migrations/20261013060000_normalize_monthly_review_month_start/migration.sql",
      ),
      "utf8",
    );
    for (const statement of migration.split(/;\s*\n/)) {
      if (statement.replace(/--.*$/gm, "").trim()) {
        await db.client.$executeRawUnsafe(statement);
      }
    }

    expect(await reviewStatesFor("2026-09-01")).toEqual({
      timeline: [["2026-09-01", "GENERATED"]],
      deck: "GENERATED",
    });
  });
});

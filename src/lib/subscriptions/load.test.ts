import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import { loadSubscriptionReview } from "./load";

describe("loadSubscriptionReview", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase(db);
  });

  it("dates each decision by its last update", async () => {
    const account = await db.client.account.create({
      data: { name: "Brukskonto" },
    });
    for (const merchant of ["viaplay", "hbo"]) {
      for (const day of ["2026-07-01", "2026-08-01", "2026-09-01"]) {
        await db.client.transaction.create({
          data: {
            accountId: account.id,
            bookingDate: new Date(`${day}T00:00:00.000Z`),
            amountNok: -99,
            currency: "NOK",
            merchant,
            normalizedMerchant: merchant,
          },
        });
      }
    }
    await db.client.subscriptionDecision.createMany({
      data: [
        {
          normalizedMerchant: "viaplay",
          status: "ENDED",
          updatedAt: new Date(2026, 7, 15, 12),
        },
        {
          normalizedMerchant: "hbo",
          status: "ENDED",
          updatedAt: new Date(2026, 8, 5, 12),
        },
      ],
    });

    const review = await loadSubscriptionReview(db.client, "2026-09-15");

    expect(
      review.ended.map(({ candidate, alerts }) => [
        candidate.normalizedMerchant,
        alerts,
      ]),
    ).toEqual([
      ["hbo", []],
      ["viaplay", [{ kind: "CHARGED_AFTER_END", chargedOn: "2026-09-01" }]],
    ]);
  });
});

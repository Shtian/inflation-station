import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import {
  clearSubscriptionDecision,
  setSubscriptionDecision,
} from "./decisions";

describe("subscription decisions", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase(db);
  });

  const stored = () =>
    db.client.subscriptionDecision.findMany({
      select: { normalizedMerchant: true, status: true },
      orderBy: { normalizedMerchant: "asc" },
    });

  it("keeps one decision per merchant however often it is set", async () => {
    await setSubscriptionDecision(db.client, "netflix", "CONFIRMED");
    await setSubscriptionDecision(db.client, "netflix", "CONFIRMED");
    await setSubscriptionDecision(db.client, "spotify", "CONFIRMED");
    await setSubscriptionDecision(db.client, "spotify", "DISMISSED");

    expect(await stored()).toEqual([
      { normalizedMerchant: "netflix", status: "CONFIRMED" },
      { normalizedMerchant: "spotify", status: "DISMISSED" },
    ]);
  });

  it("moves a confirmed decision to ended and back", async () => {
    await setSubscriptionDecision(db.client, "netflix", "ENDED");
    const ended = await stored();
    await setSubscriptionDecision(db.client, "netflix", "CONFIRMED");

    expect([ended, await stored()]).toEqual([
      [
        { normalizedMerchant: "netflix", status: "ENDED" },
        { normalizedMerchant: "spotify", status: "DISMISSED" },
      ],
      [
        { normalizedMerchant: "netflix", status: "CONFIRMED" },
        { normalizedMerchant: "spotify", status: "DISMISSED" },
      ],
    ]);
  });

  it("clears a decision and tolerates clearing it again", async () => {
    await clearSubscriptionDecision(db.client, "spotify");
    await clearSubscriptionDecision(db.client, "spotify");

    expect(await stored()).toEqual([
      { normalizedMerchant: "netflix", status: "CONFIRMED" },
    ]);
  });
});

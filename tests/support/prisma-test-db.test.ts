import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  installFailureTrigger,
  removeFailureTrigger,
  type TestDatabase,
  teardownTestDatabase,
} from "./prisma-test-db";

describe("prisma-test-db harness", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  it("creates a migrated database in the OS temp dir, never in the dev database location", () => {
    expect(db.databasePath.startsWith(path.resolve(tmpdir()))).toBe(true);
    expect(db.databasePath).not.toContain("prisma/dev.db");
    expect(db.databaseUrl).toBe(`file:${db.databasePath}`);
  });

  it("applies committed migrations so schema tables are queryable", async () => {
    await expect(db.client.account.findMany()).resolves.toEqual([]);
    await expect(db.client.importReviewSession.findMany()).resolves.toEqual([]);
  });

  it("rolls back a real transaction when a later write throws", async () => {
    await expect(
      db.client.$transaction(async (tx) => {
        await tx.account.create({ data: { name: "Rollback Test Account" } });
        throw new Error("forced failure after write");
      }),
    ).rejects.toThrow("forced failure after write");

    const accounts = await db.client.account.findMany();
    expect(accounts).toEqual([]);
  });

  it("rolls back a real transaction when a raw-SQL failure trigger fires mid-transaction", async () => {
    const triggerName = await installFailureTrigger(db.client, {
      table: "ImportReviewRow",
      event: "INSERT",
      message: "forced insert failure for test",
    });

    try {
      const account = await db.client.account.create({
        data: { name: "Trigger Test Account" },
      });
      let caughtError: unknown;

      try {
        await db.client.$transaction(async (tx) => {
          const session = await tx.importReviewSession.create({
            data: { accountId: account.id },
          });
          await tx.importReviewRow.create({
            data: {
              sessionId: session.id,
              rowNumber: 1,
              bookingDate: new Date("2026-01-01"),
              amountNok: 100,
              currency: "NOK",
              normalizedMerchant: "Test Merchant",
              sender: "Sender",
              recipient: "Recipient",
              name: "Name",
              title: "Title",
            },
          });
        });
      } catch (error) {
        caughtError = error;
      }

      // SQLite reports a triggered RAISE(ABORT, ...) as SQLITE_CONSTRAINT_TRIGGER,
      // which the driver adapter surfaces as a generic Prisma FK-violation error
      // (top-level `message` is generic) rather than putting our RAISE message on
      // top. The original message is still present on the error, so consumers of
      // this harness that need to distinguish "forced test failure" from a real
      // constraint violation should assert against the full serialized error, not
      // just `error.message`.
      expect(caughtError).toBeDefined();
      expect(JSON.stringify(caughtError)).toContain(
        "forced insert failure for test",
      );

      const sessions = await db.client.importReviewSession.findMany();
      expect(sessions).toEqual([]);
    } finally {
      await removeFailureTrigger(db.client, triggerName);
    }
  });

  it("cascades deletion from an import review session to its rows via the real FK constraint", async () => {
    const account = await db.client.account.create({
      data: { name: "Cascade Test Account" },
    });
    const session = await db.client.importReviewSession.create({
      data: { accountId: account.id },
    });
    await db.client.importReviewRow.createMany({
      data: [1, 2].map((rowNumber) => ({
        sessionId: session.id,
        rowNumber,
        bookingDate: new Date("2026-01-01"),
        amountNok: 50,
        currency: "NOK",
        normalizedMerchant: "Merchant",
        sender: "Sender",
        recipient: "Recipient",
        name: "Name",
        title: "Title",
      })),
    });

    await expect(
      db.client.importReviewRow.findMany({ where: { sessionId: session.id } }),
    ).resolves.toHaveLength(2);

    await db.client.importReviewSession.delete({ where: { id: session.id } });

    const remainingRows = await db.client.importReviewRow.findMany({
      where: { sessionId: session.id },
    });
    expect(remainingRows).toEqual([]);
  });
});

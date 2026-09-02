import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "./prisma-test-db";

/**
 * Runs alongside prisma-test-db.test.ts (and its own concurrent database) to
 * prove the harness does not rely on any shared global state or a single
 * database file - each test file gets its own isolated, uniquely-located
 * temp database and does not collide with any other test file's database.
 */
describe("prisma-test-db harness (second file, concurrency check)", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  it("uses a database path distinct from other harness-created databases", async () => {
    const other = await createTestDatabase();
    try {
      expect(other.databasePath).not.toBe(db.databasePath);
      expect(other.databaseDir).not.toBe(db.databaseDir);
    } finally {
      await teardownTestDatabase(other);
    }
  });

  it("can read and write independently of any other test file's database", async () => {
    const account = await db.client.account.create({
      data: { name: "Parallel File Account" },
    });
    await expect(db.client.account.findMany()).resolves.toEqual([
      expect.objectContaining({
        id: account.id,
        name: "Parallel File Account",
      }),
    ]);
  });
});

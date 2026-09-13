import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  assertNotDevelopmentDatabase,
  INTEGRATED_DATABASE_URL,
  layFixture,
  resolveSqliteFilePath,
} from "./integrated-database";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "./prisma-test-db";

describe("assertNotDevelopmentDatabase", () => {
  test("refuses the development database named the way prisma.config.ts names it", () => {
    expect(() => assertNotDevelopmentDatabase("file:./prisma/dev.db")).toThrow(
      "Refusing to truncate the development database.",
    );
  });

  test("refuses the development database named by absolute path", () => {
    const absoluteUrl = `file:${resolveSqliteFilePath("file:./prisma/dev.db")}`;

    expect(() => assertNotDevelopmentDatabase(absoluteUrl)).toThrow(
      "Refusing to truncate the development database.",
    );
  });

  test("names the resolved file and the database to use instead", () => {
    let message = "";
    try {
      assertNotDevelopmentDatabase("file:./prisma/dev.db");
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(resolveSqliteFilePath("file:./prisma/dev.db"));
    expect(message).toContain(INTEGRATED_DATABASE_URL);
  });

  test("allows the integrated database", () => {
    expect(() =>
      assertNotDevelopmentDatabase(INTEGRATED_DATABASE_URL),
    ).not.toThrow();
  });
});

describe("layFixture", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase(db);
  });

  test("refuses a development database before it opens a connection", async () => {
    // A throwaway file named dev.db, so deleting the guard fails this test
    // rather than emptying the developer's own database.
    const decoyDir = await mkdtemp(path.join(tmpdir(), "integrated-guard-"));
    const decoyUrl = `file:${path.join(decoyDir, "dev.db")}`;

    try {
      await expect(
        layFixture({ accounts: [], transactions: [] }, decoyUrl),
      ).rejects.toThrow("Refusing to truncate the development database.");
    } finally {
      await rm(decoyDir, { recursive: true, force: true });
    }
  });

  test("stores a merchant search key that disagrees with the merchant", async () => {
    await layFixture(
      {
        accounts: [{ name: "Checking" }],
        transactions: [
          {
            account: "Checking",
            bookingDate: "2026-03-04",
            amountNok: -249.9,
            merchant: "Bæveren Ølhus",
            searchKey: "kaffeslabberas gamlebyen",
          },
        ],
      },
      db.databaseUrl,
    );

    const stored = await db.client.transaction.findFirstOrThrow({
      select: { merchant: true, normalizedMerchant: true, currency: true },
    });

    expect(stored.merchant).toBe("Bæveren Ølhus");
    expect(stored.normalizedMerchant).toBe("kaffeslabberas gamlebyen");
    expect(stored.currency).toBe("NOK");
  });

  test("derives the search key from the merchant when none is given", async () => {
    await layFixture(
      {
        accounts: [{ name: "Checking" }],
        transactions: [
          {
            account: "Checking",
            bookingDate: "2026-03-04",
            amountNok: -249.9,
            merchant: "Bær & Øl Åsen AS",
          },
        ],
      },
      db.databaseUrl,
    );

    const stored = await db.client.transaction.findFirstOrThrow({
      select: { normalizedMerchant: true },
    });

    expect(stored.normalizedMerchant).toBe("baer ol asen as");
  });

  test("leaves nothing behind from the previous fixture", async () => {
    await layFixture(
      {
        accounts: [{ name: "Checking" }],
        categories: [{ name: "Groceries" }],
        transactions: [
          {
            account: "Checking",
            category: "Groceries",
            bookingDate: "2026-03-04",
            amountNok: -249.9,
            merchant: "Rimi Storgata",
            note: "Weekly shop",
          },
        ],
      },
      db.databaseUrl,
    );

    await layFixture(
      {
        accounts: [{ name: "Savings" }],
        transactions: [],
      },
      db.databaseUrl,
    );

    expect(await db.client.transaction.count()).toBe(0);
    expect(await db.client.category.count()).toBe(0);
    expect(
      await db.client.account.findMany({
        select: { name: true },
        orderBy: { name: "asc" },
      }),
    ).toEqual([{ name: "Savings" }]);
  });

  test("fills in the columns a spec does not state", async () => {
    await layFixture(
      {
        accounts: [{ name: "Checking" }],
        transactions: [
          {
            account: "Checking",
            bookingDate: "2026-03-04",
            amountNok: -249.9,
            merchant: "Rimi Storgata",
          },
        ],
      },
      db.databaseUrl,
    );

    const stored = await db.client.transaction.findFirstOrThrow({
      select: {
        bookingDate: true,
        categoryId: true,
        currency: true,
        note: true,
        paymentType: true,
      },
    });

    expect(stored.bookingDate.toISOString()).toBe("2026-03-04T00:00:00.000Z");
    expect(stored.categoryId).toBeNull();
    expect(stored.currency).toBe("NOK");
    expect(stored.note).toBeNull();
    expect(stored.paymentType).toBe("OTHER");
  });

  test("reports a transaction that names an undeclared account", async () => {
    await expect(
      layFixture(
        {
          accounts: [{ name: "Checking" }],
          transactions: [
            {
              account: "Savings",
              bookingDate: "2026-03-04",
              amountNok: -249.9,
              merchant: "Rimi Storgata",
            },
          ],
        },
        db.databaseUrl,
      ),
    ).rejects.toThrow(
      'Fixture transaction names the account "Savings", which the fixture does not declare. Declared accounts: "Checking".',
    );
  });

  test("reports a booking date that is not a calendar day", async () => {
    await expect(
      layFixture(
        {
          accounts: [{ name: "Checking" }],
          transactions: [
            {
              account: "Checking",
              bookingDate: "04.03.2026",
              amountNok: -249.9,
              merchant: "Rimi Storgata",
            },
          ],
        },
        db.databaseUrl,
      ),
    ).rejects.toThrow('Fixture bookingDate "04.03.2026" is not YYYY-MM-DD.');
  });
});

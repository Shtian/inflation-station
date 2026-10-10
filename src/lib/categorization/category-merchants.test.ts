import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import {
  aggregateMerchantFamilies,
  getAllCategoryProfiles,
  getCategoryMerchantHistory,
  labelForFamily,
} from "./category-merchants";

describe("labelForFamily", () => {
  it.each([
    [["KIWI 0445 STOVNER", "KIWI 112 MAJORSTUEN"], "Kiwi"],
    [["NORSK ARBEIDSGIVER AS"], "Norsk Arbeidsgiver"],
    [["REMA 1000 OSLO GRØNLAND 4"], "Rema"],
    [["MENY BOGSTADVEIEN"], "Meny Bogstadveien"],
    [["VIPPS RUTER AS"], "Ruter"],
    [["GRØNLAND BAKERI"], "Grønland Bakeri"],
    [["McDonalds Storo"], "McDonalds Storo"],
  ])("labels %j as %s", (displayNames, label) => {
    expect(labelForFamily(new Map(displayNames.map((name) => [name, 1])))).toBe(
      label,
    );
  });

  it("falls back to the first word of the most common name when members share no prefix", () => {
    expect(
      labelForFamily(
        new Map([
          ["Vipps*Kiwi Storo", 1],
          ["KIWI STOVNER", 4],
        ]),
      ),
    ).toBe("Kiwi");
  });
});

describe("aggregateMerchantFamilies", () => {
  it("groups stores of one brand into a family and sorts by count", () => {
    expect(
      aggregateMerchantFamilies([
        {
          normalizedMerchant: "rema 1000 oslo",
          merchant: "REMA 1000 OSLO",
          count: 1,
        },
        {
          normalizedMerchant: "kiwi 0445 stovner",
          merchant: "KIWI 0445 STOVNER",
          count: 3,
        },
        {
          normalizedMerchant: "kiwi 112 majorstuen",
          merchant: "KIWI 112 MAJORSTUEN",
          count: 2,
        },
      ]),
    ).toEqual([
      { key: "kiwi", label: "Kiwi", transactionCount: 5 },
      { key: "rema", label: "Rema", transactionCount: 1 },
    ]);
  });

  it("keeps the 50 most used families", () => {
    const rows = Array.from({ length: 60 }, (_, index) => {
      const name = `SHOP${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`;
      return {
        normalizedMerchant: name.toLowerCase(),
        merchant: name,
        count: index + 1,
      };
    });

    const merchants = aggregateMerchantFamilies(rows);

    expect(merchants).toHaveLength(50);
    expect(merchants[0]).toEqual({
      key: "shopch",
      label: "Shopch",
      transactionCount: 60,
    });
    expect(merchants[49]).toEqual({
      key: "shopak",
      label: "Shopak",
      transactionCount: 11,
    });
  });
});

describe("getCategoryMerchantHistory", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  async function addTransaction(
    accountId: string,
    categoryId: string,
    normalizedMerchant: string,
    merchant: string | null,
  ) {
    await db.client.transaction.create({
      data: {
        accountId,
        categoryId,
        bookingDate: new Date("2026-03-01"),
        amountNok: -100,
        currency: "NOK",
        normalizedMerchant,
        merchant,
      },
    });
  }

  it("returns only the requested category's merchant families", async () => {
    const account = await db.client.account.create({
      data: { name: "Checking" },
    });
    const groceries = await db.client.category.create({
      data: { name: "Groceries" },
    });
    const dining = await db.client.category.create({
      data: { name: "Dining" },
    });
    await addTransaction(
      account.id,
      groceries.id,
      "kiwi 0445 stovner",
      "KIWI 0445 STOVNER",
    );
    await addTransaction(
      account.id,
      groceries.id,
      "kiwi 0445 stovner",
      "KIWI 0445 STOVNER",
    );
    await addTransaction(account.id, groceries.id, "kiwi 112 majorstuen", null);
    await addTransaction(
      account.id,
      groceries.id,
      "meny bogstadveien",
      "MENY BOGSTADVEIEN",
    );
    await addTransaction(account.id, dining.id, "kiwi 9 storo", "KIWI 9 STORO");

    await expect(
      getCategoryMerchantHistory(db.client, groceries.id),
    ).resolves.toEqual({
      transactionCount: 4,
      merchants: [
        { key: "kiwi", label: "Kiwi", transactionCount: 3 },
        { key: "meny", label: "Meny Bogstadveien", transactionCount: 1 },
      ],
    });
  });

  it("returns null for an unknown category", async () => {
    await expect(
      getCategoryMerchantHistory(db.client, "missing-category"),
    ).resolves.toBeNull();
  });

  it("returns an empty history for a category without transactions", async () => {
    const category = await db.client.category.create({
      data: { name: "Empty" },
    });

    await expect(
      getCategoryMerchantHistory(db.client, category.id),
    ).resolves.toEqual({ transactionCount: 0, merchants: [] });
  });
});

describe("getAllCategoryProfiles", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  it("aggregates every category's merchant families in one pass", async () => {
    const account = await db.client.account.create({
      data: { name: "Checking" },
    });
    const groceries = await db.client.category.create({
      data: { name: "Groceries" },
    });
    const salary = await db.client.category.create({
      data: { name: "Salary", kind: "INCOME" },
    });
    const empty = await db.client.category.create({
      data: { name: "Empty" },
    });
    const transactions = [
      [groceries.id, "kiwi 0445 stovner", "KIWI 0445 STOVNER"],
      [groceries.id, "kiwi 112 majorstuen", null],
      [groceries.id, "rema 1000 oslo", "REMA 1000 OSLO"],
      [salary.id, "norsk arbeidsgiver as", "NORSK ARBEIDSGIVER AS"],
      [null, "kiwi 9 storo", "KIWI 9 STORO"],
    ] as const;
    for (const [categoryId, normalizedMerchant, merchant] of transactions) {
      await db.client.transaction.create({
        data: {
          accountId: account.id,
          categoryId,
          bookingDate: new Date("2026-03-01"),
          amountNok: -100,
          currency: "NOK",
          normalizedMerchant,
          merchant,
        },
      });
    }

    await expect(getAllCategoryProfiles(db.client)).resolves.toEqual([
      { id: empty.id, name: "Empty", kind: "EXPENSE", merchants: [] },
      {
        id: groceries.id,
        name: "Groceries",
        kind: "EXPENSE",
        merchants: [
          { key: "kiwi", label: "Kiwi", transactionCount: 2 },
          { key: "rema", label: "Rema", transactionCount: 1 },
        ],
      },
      {
        id: salary.id,
        name: "Salary",
        kind: "INCOME",
        merchants: [
          {
            key: "norsk",
            label: "Norsk Arbeidsgiver",
            transactionCount: 1,
          },
        ],
      },
    ]);
  });
});

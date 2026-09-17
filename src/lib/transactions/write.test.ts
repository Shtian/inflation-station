import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { normalizeImportMerchant } from "@/lib/import/normalization";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import { getTransactionsPage } from "./list";
import { MAX_TRANSACTION_NOTE_LENGTH_MESSAGE } from "./note";
import {
  createTransaction,
  parseTransactionCreatePayload,
  parseTransactionUpdatePayload,
  updateTransaction,
} from "./write";

function accepted<T>(result: z.ZodSafeParseResult<T>): T {
  if (!result.success) {
    throw new Error(
      `expected the payload to be accepted, got ${JSON.stringify(result.error.issues)}`,
    );
  }
  return result.data;
}

function rejection<T>(result: z.ZodSafeParseResult<T>): {
  messages: string[];
  paths: string[];
} {
  if (result.success) {
    throw new Error(
      `expected the payload to be rejected, got ${JSON.stringify(result.data)}`,
    );
  }
  return {
    messages: result.error.issues.map((issue) => issue.message),
    paths: result.error.issues.map((issue) => issue.path.join(".")),
  };
}

function createIntent(payload: Record<string, unknown>) {
  return accepted(parseTransactionCreatePayload(payload));
}

function updateIntent(payload: Record<string, unknown>) {
  return accepted(parseTransactionUpdatePayload(payload));
}

const VALID_CREATE_PAYLOAD = {
  accountId: "placeholder",
  bookingDate: "2026-01-15",
  amountNok: -100.25,
  merchant: "Corner Shop",
  paymentType: "CARD",
};

describe("parseTransactionCreatePayload", () => {
  it.each([
    "2026-02-31",
    "2026-13-01",
    "15-01-2026",
    "2026-1-5",
    "",
  ])("rejects bookingDate %j", (bookingDate) => {
    expect(
      rejection(
        parseTransactionCreatePayload({
          ...VALID_CREATE_PAYLOAD,
          bookingDate,
        }),
      ).messages,
    ).toContain("Expected bookingDate in YYYY-MM-DD format.");
  });

  it("turns a calendar date into midnight UTC", () => {
    expect(
      createIntent({
        ...VALID_CREATE_PAYLOAD,
        bookingDate: "2026-01-15",
      }).bookingDate.toISOString(),
    ).toBe("2026-01-15T00:00:00.000Z");
  });

  it("accepts a note of exactly the maximum length once trimmed", () => {
    const maxLengthNote = "n".repeat(500);

    expect(
      createIntent({ ...VALID_CREATE_PAYLOAD, note: maxLengthNote }).note,
    ).toBe(maxLengthNote);
    expect(
      createIntent({ ...VALID_CREATE_PAYLOAD, note: ` ${maxLengthNote} ` })
        .note,
    ).toBe(maxLengthNote);
  });

  it("rejects a note that is one character over the limit once trimmed", () => {
    expect(
      rejection(
        parseTransactionCreatePayload({
          ...VALID_CREATE_PAYLOAD,
          note: ` ${"n".repeat(501)} `,
        }),
      ).messages,
    ).toContain(MAX_TRANSACTION_NOTE_LENGTH_MESSAGE);
  });

  it("rejects currency and normalizedMerchant", () => {
    expect(
      rejection(
        parseTransactionCreatePayload({
          ...VALID_CREATE_PAYLOAD,
          currency: "USD",
        }),
      ).messages.join(" "),
    ).toContain("currency");
    expect(
      rejection(
        parseTransactionCreatePayload({
          ...VALID_CREATE_PAYLOAD,
          normalizedMerchant: "corner shop",
        }),
      ).messages.join(" "),
    ).toContain("normalizedMerchant");
  });

  it("rejects a merchant with no non-whitespace characters", () => {
    expect(
      rejection(
        parseTransactionCreatePayload({
          ...VALID_CREATE_PAYLOAD,
          merchant: "   ",
        }),
      ).paths,
    ).toContain("merchant");
  });
});

describe("parseTransactionUpdatePayload", () => {
  it.each([
    "id",
    "accountId",
    "createdAt",
    "updatedAt",
  ])("rejects the server-owned field %s", (field) => {
    expect(
      rejection(
        parseTransactionUpdatePayload({
          merchant: "Corner Shop",
          [field]: "anything",
        }),
      ).paths,
    ).toContain(field);
  });

  it.each([
    "currency",
    "normalizedMerchant",
  ])("rejects the derived field %s", (field) => {
    expect(
      rejection(
        parseTransactionUpdatePayload({
          merchant: "Corner Shop",
          [field]: "anything",
        }),
      ).messages.join(" "),
    ).toContain(field);
  });

  it("rejects an update that changes nothing", () => {
    expect(rejection(parseTransactionUpdatePayload({})).messages).toContain(
      "At least one mutable field must be provided.",
    );
  });

  it("applies the note length limit after trimming", () => {
    const maxLengthNote = "n".repeat(500);

    expect(updateIntent({ note: ` ${maxLengthNote} ` }).note).toBe(
      maxLengthNote,
    );
    expect(
      rejection(parseTransactionUpdatePayload({ note: "n".repeat(501) }))
        .messages,
    ).toContain(MAX_TRANSACTION_NOTE_LENGTH_MESSAGE);
  });
});

describe("transaction writes (real database)", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  async function seedAccount(name = "Everyday") {
    return db.client.account.create({ data: { name } });
  }

  it("persists a canonical row and returns only its id", async () => {
    const account = await seedAccount();
    const category = await db.client.category.create({
      data: { name: "Groceries" },
    });

    const created = await createTransaction(
      db.client,
      createIntent({
        accountId: account.id,
        categoryId: category.id,
        bookingDate: "2026-01-15",
        amountNok: -100.25,
        merchant: "  Corner Shop  ",
        paymentType: "CARD",
        note: "  weekly run  ",
      }),
    );

    expect(Object.keys(created)).toEqual(["id"]);

    const persisted = await db.client.transaction.findUniqueOrThrow({
      where: { id: created.id },
    });

    expect(persisted.accountId).toBe(account.id);
    expect(persisted.categoryId).toBe(category.id);
    expect(persisted.merchant).toBe("Corner Shop");
    expect(persisted.normalizedMerchant).toBe("corner shop");
    expect(persisted.currency).toBe("NOK");
    expect(persisted.bookingDate.toISOString()).toBe(
      "2026-01-15T00:00:00.000Z",
    );
    expect(persisted.note).toBe("weekly run");
    expect(Number.parseFloat(persisted.amountNok.toString())).toBe(-100.25);
    expect(persisted.createdAt.toISOString()).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(persisted.updatedAt.toISOString()).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("stores an absent, empty or whitespace-only note as null and trims the rest", async () => {
    const account = await seedAccount();
    const base = {
      accountId: account.id,
      bookingDate: "2026-01-15",
      amountNok: 10,
      merchant: "Corner Shop",
      paymentType: "CARD",
    };

    const created = [];
    for (const note of [undefined, null, "", "   ", "  bought milk  "]) {
      created.push(
        await createTransaction(
          db.client,
          createIntent(note === undefined ? base : { ...base, note }),
        ),
      );
    }

    const persisted = await Promise.all(
      created.map(async (row) =>
        db.client.transaction.findUniqueOrThrow({ where: { id: row.id } }),
      ),
    );
    expect(persisted.map((record) => record.note)).toEqual([
      null,
      null,
      null,
      null,
      "bought milk",
    ]);
  });

  it("accepts negative, zero and positive amounts", async () => {
    const account = await seedAccount();
    const base = {
      accountId: account.id,
      bookingDate: "2026-01-15",
      merchant: "Corner Shop",
      paymentType: "CARD",
    };

    const created = [];
    for (const amountNok of [-1234.5, 0, 99.99]) {
      created.push(
        await createTransaction(
          db.client,
          createIntent({ ...base, amountNok }),
        ),
      );
    }

    const persisted = await Promise.all(
      created.map(async (row) =>
        db.client.transaction.findUniqueOrThrow({ where: { id: row.id } }),
      ),
    );
    expect(
      persisted.map((record) => Number.parseFloat(record.amountNok.toString())),
    ).toEqual([-1234.5, 0, 99.99]);
  });

  it("rewrites normalizedMerchant on update so the old merchant stops matching search", async () => {
    const account = await seedAccount();
    const created = await createTransaction(
      db.client,
      createIntent({
        accountId: account.id,
        bookingDate: "2026-01-15",
        amountNok: -50,
        merchant: "Old Corner Shop",
        paymentType: "CARD",
      }),
    );

    await updateTransaction(db.client, {
      transactionId: created.id,
      updates: updateIntent({ merchant: "New Corner Shop" }),
    });

    const persisted = await db.client.transaction.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(persisted.merchant).toBe("New Corner Shop");
    expect(persisted.normalizedMerchant).toBe("new corner shop");

    const stale = await getTransactionsPage(db.client, {
      query: "old corner shop",
      page: 1,
      pageSize: 25,
    });
    expect(stale.rows).toEqual([]);
    expect(stale.pagination.total).toBe(0);

    const current = await getTransactionsPage(db.client, {
      query: "new corner shop",
      page: 1,
      pageSize: 25,
    });
    expect(current.rows.map((row) => row.id)).toEqual([created.id]);
    expect(current.pagination.total).toBe(1);
  });

  it("finds the same merchant whether it was typed or imported", async () => {
    const account = await seedAccount();
    const typed = await createTransaction(
      db.client,
      createIntent({
        accountId: account.id,
        bookingDate: "2026-01-15",
        amountNok: -120,
        merchant: "Bær & Øl Åsen AS",
        paymentType: "CARD",
      }),
    );
    const imported = await db.client.transaction.create({
      data: {
        accountId: account.id,
        bookingDate: new Date("2026-01-16T00:00:00.000Z"),
        amountNok: -80,
        currency: "NOK",
        merchant: "Varekjøp",
        normalizedMerchant: normalizeImportMerchant(
          "BÆR & ØL ÅSEN AS",
          "Varekjøp",
        ),
        paymentType: "CARD",
      },
    });
    await createTransaction(
      db.client,
      createIntent({
        accountId: account.id,
        bookingDate: "2026-01-17",
        amountNok: -30,
        merchant: "Corner Shop",
        paymentType: "CARD",
      }),
    );

    const persisted = await db.client.transaction.findUniqueOrThrow({
      where: { id: typed.id },
    });
    expect(persisted.normalizedMerchant).toBe("baer ol asen as");

    const expectedIds = [typed.id, imported.id].sort();
    for (const query of ["bær & øl", "baer ol", "Øl Åsen", "BÆR"]) {
      const page = await getTransactionsPage(db.client, {
        query,
        page: 1,
        pageSize: 25,
      });
      expect(page.rows.map((row) => row.id).sort(), query).toEqual(expectedIds);
      expect(page.pagination.total, query).toBe(2);
    }
  });

  it("leaves merchant, normalizedMerchant and note untouched when an update omits them", async () => {
    const account = await seedAccount();
    const created = await createTransaction(
      db.client,
      createIntent({
        accountId: account.id,
        bookingDate: "2026-01-15",
        amountNok: -50,
        merchant: "Corner Shop",
        paymentType: "CARD",
        note: "weekly run",
      }),
    );

    await updateTransaction(db.client, {
      transactionId: created.id,
      updates: updateIntent({ amountNok: -75.5 }),
    });

    const persisted = await db.client.transaction.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(persisted.merchant).toBe("Corner Shop");
    expect(persisted.normalizedMerchant).toBe("corner shop");
    expect(persisted.note).toBe("weekly run");
    expect(Number.parseFloat(persisted.amountNok.toString())).toBe(-75.5);
  });

  it("leaves a stored non-NOK currency alone when an update changes another field", async () => {
    const account = await seedAccount();
    const created = await createTransaction(
      db.client,
      createIntent({
        accountId: account.id,
        bookingDate: "2026-01-15",
        amountNok: -50,
        merchant: "Corner Shop",
        paymentType: "CARD",
      }),
    );

    await db.client.transaction.update({
      where: { id: created.id },
      data: { currency: "EUR" },
    });

    await updateTransaction(db.client, {
      transactionId: created.id,
      updates: updateIntent({ amountNok: -75.5 }),
    });

    const persisted = await db.client.transaction.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(persisted.currency).toBe("EUR");
    expect(Number.parseFloat(persisted.amountNok.toString())).toBe(-75.5);
  });

  it("preserves, clears and rewrites the note across successive updates", async () => {
    const account = await seedAccount();
    const created = await createTransaction(
      db.client,
      createIntent({
        accountId: account.id,
        bookingDate: "2026-01-15",
        amountNok: -50,
        merchant: "Corner Shop",
        paymentType: "CARD",
        note: "weekly run",
      }),
    );

    const observed: (string | null)[] = [];
    for (const updates of [
      { amountNok: -51 },
      { note: null },
      { note: "  restored  " },
      { note: "" },
      { note: "  again  " },
      { note: "   " },
    ]) {
      await updateTransaction(db.client, {
        transactionId: created.id,
        updates: updateIntent(updates),
      });
      const persisted = await db.client.transaction.findUniqueOrThrow({
        where: { id: created.id },
      });
      observed.push(persisted.note);
    }

    expect(observed).toEqual([
      "weekly run",
      null,
      "restored",
      null,
      "again",
      null,
    ]);
  });

  it("leaves category unset on create, clears it on null and preserves it when omitted", async () => {
    const account = await seedAccount();
    const category = await db.client.category.create({
      data: { name: "Groceries" },
    });
    const created = await createTransaction(
      db.client,
      createIntent({
        accountId: account.id,
        bookingDate: "2026-01-15",
        amountNok: -50,
        merchant: "Corner Shop",
        paymentType: "CARD",
      }),
    );

    async function listedRow() {
      const page = await getTransactionsPage(db.client, {
        page: 1,
        pageSize: 25,
      });
      return page.rows.find((row) => row.id === created.id);
    }

    expect((await listedRow())?.categoryId).toBeNull();
    expect((await listedRow())?.categoryName).toBeNull();

    await updateTransaction(db.client, {
      transactionId: created.id,
      updates: updateIntent({ categoryId: category.id }),
    });
    expect((await listedRow())?.categoryId).toBe(category.id);
    expect((await listedRow())?.categoryName).toBe("Groceries");

    await updateTransaction(db.client, {
      transactionId: created.id,
      updates: updateIntent({ amountNok: -60 }),
    });
    expect((await listedRow())?.categoryId).toBe(category.id);

    await updateTransaction(db.client, {
      transactionId: created.id,
      updates: updateIntent({ categoryId: null }),
    });
    expect((await listedRow())?.categoryId).toBeNull();
    expect((await listedRow())?.categoryName).toBeNull();
    expect(
      (
        await db.client.transaction.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).categoryId,
    ).toBeNull();
  });

  it("write functions return only the persisted id, unlike the list row shape", async () => {
    const account = await seedAccount();
    const created = await createTransaction(
      db.client,
      createIntent({
        accountId: account.id,
        bookingDate: "2026-01-15",
        amountNok: -50,
        merchant: "Corner Shop",
        paymentType: "CARD",
      }),
    );
    const updated = await updateTransaction(db.client, {
      transactionId: created.id,
      updates: updateIntent({ note: "edited" }),
    });
    const listed = await getTransactionsPage(db.client, {
      page: 1,
      pageSize: 25,
    });

    expect(Object.keys(created)).toEqual(["id"]);
    expect(Object.keys(updated)).toEqual(["id"]);
    expect(Object.keys(listed.rows[0]).sort()).toEqual([
      "accountId",
      "accountName",
      "amountNok",
      "bookingDate",
      "categoryId",
      "categoryName",
      "createdAt",
      "currency",
      "id",
      "merchant",
      "normalizedMerchant",
      "note",
      "paymentType",
      "updatedAt",
    ]);
    expect(listed.rows[0].id).toBe(created.id);
    expect(listed.rows[0].note).toBe("edited");
  });

  it("matches note search by exact text and ASCII case only", async () => {
    const account = await seedAccount();
    await createTransaction(
      db.client,
      createIntent({
        accountId: account.id,
        bookingDate: "2026-01-15",
        amountNok: -50,
        merchant: "Corner Shop",
        paymentType: "CARD",
        note: "Kjøpt på Grünerløkka",
      }),
    );

    for (const [query, total] of [
      ["Grünerløkka", 1],
      ["grünerløkka", 1],
      ["GRÜNERLØKKA", 0],
      ["Kjopt", 0],
    ] as const) {
      const page = await getTransactionsPage(db.client, {
        query,
        page: 1,
        pageSize: 25,
      });
      expect(page.pagination.total, query).toBe(total);
    }
  });
});

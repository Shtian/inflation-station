import { PaymentType } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  installFailureTrigger,
  removeFailureTrigger,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import { normalizeImportMerchant } from "./normalization";
import {
  ImportReviewSessionNotFoundError,
  InvalidImportReviewCategoryError,
  InvalidImportReviewDecisionsError,
  submitImportReview,
} from "./review-submit";

describe("submitImportReview - atomic consumption (real database)", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  it("inserts only the selected rows, applies their decisions, and removes the complete session", async () => {
    const account = await db.client.account.create({
      data: { name: "Atomic Consume Account" },
    });
    const category = await db.client.category.create({
      data: { name: "Groceries" },
    });
    const session = await db.client.importReviewSession.create({
      data: { accountId: account.id, invalidCount: 0 },
    });

    const row1 = await db.client.importReviewRow.create({
      data: {
        sessionId: session.id,
        rowNumber: 2,
        bookingDate: new Date("2026-01-01T00:00:00.000Z"),
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant: "groceries friday",
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shop A",
        name: "Groceries",
        title: "Friday",
        categoryId: null,
      },
    });
    const row2 = await db.client.importReviewRow.create({
      data: {
        sessionId: session.id,
        rowNumber: 3,
        bookingDate: new Date("2026-01-02T00:00:00.000Z"),
        amountNok: 200,
        currency: "NOK",
        normalizedMerchant: "fuel station",
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shell",
        name: "Fuel",
        title: "Shell",
        categoryId: null,
      },
    });

    const result = await submitImportReview(db.client, {
      sessionId: session.id,
      rows: [
        {
          rowId: row1.id,
          categoryId: category.id,
          selectedMessage: "Friday Groceries",
          note: "Weekly shop",
        },
      ],
    });

    expect(result.summary.imported).toBe(1);

    const transactions = await db.client.transaction.findMany({
      where: { accountId: account.id },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.categoryId).toBe(category.id);
    expect(transactions[0]?.merchant).toBe("Friday Groceries");
    expect(transactions[0]?.note).toBe("Weekly shop");
    expect(
      Number.parseFloat(transactions[0]?.amountNok.toString() ?? "NaN"),
    ).toBe(100);

    const persistedSession = await db.client.importReviewSession.findUnique({
      where: { id: session.id },
    });
    expect(persistedSession).toBeNull();

    const persistedRows = await db.client.importReviewRow.findMany({
      where: { sessionId: session.id },
    });
    expect(persistedRows).toEqual([]);

    // Sanity: row2 was never selected, and its data never leaked into a
    // persisted transaction.
    expect(
      transactions.some(
        (transaction) =>
          transaction.normalizedMerchant === row2.normalizedMerchant,
      ),
    ).toBe(false);
  });

  it("imports an explicitly selected row even when it carries a potential-duplicate fingerprint", async () => {
    const account = await db.client.account.create({
      data: { name: "Duplicate Fingerprint Account" },
    });

    const bookingDate = new Date("2026-01-01T00:00:00.000Z");
    const normalizedMerchant = normalizeImportMerchant("Groceries", "Friday");

    await db.client.transaction.create({
      data: {
        accountId: account.id,
        categoryId: null,
        bookingDate,
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant,
        merchant: "Friday",
        paymentType: PaymentType.CARD,
        note: null,
      },
    });

    const session = await db.client.importReviewSession.create({
      data: { accountId: account.id, invalidCount: 0 },
    });
    const row = await db.client.importReviewRow.create({
      data: {
        sessionId: session.id,
        rowNumber: 2,
        bookingDate,
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant,
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shop A",
        name: "Groceries",
        title: "Friday",
        categoryId: null,
      },
    });

    const result = await submitImportReview(db.client, {
      sessionId: session.id,
      rows: [
        {
          rowId: row.id,
          categoryId: null,
          selectedMessage: "Friday",
        },
      ],
    });

    expect(result.summary.imported).toBe(1);

    const transactions = await db.client.transaction.findMany({
      where: { accountId: account.id },
    });
    expect(transactions).toHaveLength(2);
  });

  it("rejects an invalid selected category, inserting nothing and leaving the session intact", async () => {
    const account = await db.client.account.create({
      data: { name: "Invalid Category Account" },
    });
    const session = await db.client.importReviewSession.create({
      data: { accountId: account.id, invalidCount: 0 },
    });
    const row = await db.client.importReviewRow.create({
      data: {
        sessionId: session.id,
        rowNumber: 2,
        bookingDate: new Date("2026-01-01T00:00:00.000Z"),
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant: "groceries friday",
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shop A",
        name: "Groceries",
        title: "Friday",
        categoryId: null,
      },
    });

    await expect(
      submitImportReview(db.client, {
        sessionId: session.id,
        rows: [
          {
            rowId: row.id,
            categoryId: "does-not-exist",
            selectedMessage: "Friday",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidImportReviewCategoryError);

    const transactions = await db.client.transaction.findMany();
    expect(transactions).toEqual([]);

    const persistedSession = await db.client.importReviewSession.findUnique({
      where: { id: session.id },
    });
    expect(persistedSession).not.toBeNull();

    const persistedRows = await db.client.importReviewRow.findMany({
      where: { sessionId: session.id },
    });
    expect(persistedRows).toHaveLength(1);
  });

  it("rolls back both the insert and the session delete when a forced failure occurs after insertion but before commit", async () => {
    const account = await db.client.account.create({
      data: { name: "Forced Failure Account" },
    });
    const session = await db.client.importReviewSession.create({
      data: { accountId: account.id, invalidCount: 0 },
    });
    const row = await db.client.importReviewRow.create({
      data: {
        sessionId: session.id,
        rowNumber: 2,
        bookingDate: new Date("2026-01-01T00:00:00.000Z"),
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant: "groceries friday",
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shop A",
        name: "Groceries",
        title: "Friday",
        categoryId: null,
      },
    });

    const triggerName = await installFailureTrigger(db.client, {
      table: "Transaction",
      event: "INSERT",
      message: "forced transaction insert failure",
    });

    try {
      await expect(
        submitImportReview(db.client, {
          sessionId: session.id,
          rows: [
            {
              rowId: row.id,
              categoryId: null,
              selectedMessage: "Friday",
            },
          ],
        }),
      ).rejects.toBeDefined();

      const transactions = await db.client.transaction.findMany();
      expect(transactions).toEqual([]);

      const persistedSession = await db.client.importReviewSession.findUnique({
        where: { id: session.id },
      });
      expect(persistedSession).not.toBeNull();

      const persistedRows = await db.client.importReviewRow.findMany({
        where: { sessionId: session.id },
      });
      expect(persistedRows).toHaveLength(1);
    } finally {
      await removeFailureTrigger(db.client, triggerName);
    }
  });

  it("returns a stable not-found result on retry after a successful consume, without creating duplicate transactions", async () => {
    const account = await db.client.account.create({
      data: { name: "Retry Account" },
    });
    const session = await db.client.importReviewSession.create({
      data: { accountId: account.id, invalidCount: 0 },
    });
    const row = await db.client.importReviewRow.create({
      data: {
        sessionId: session.id,
        rowNumber: 2,
        bookingDate: new Date("2026-01-01T00:00:00.000Z"),
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant: "groceries friday",
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shop A",
        name: "Groceries",
        title: "Friday",
        categoryId: null,
      },
    });

    const submitParams = {
      sessionId: session.id,
      rows: [
        {
          rowId: row.id,
          categoryId: null,
          selectedMessage: "Friday",
        },
      ],
    };

    const firstResult = await submitImportReview(db.client, submitParams);
    expect(firstResult.summary.imported).toBe(1);

    const transactionsAfterFirst = await db.client.transaction.findMany();
    expect(transactionsAfterFirst).toHaveLength(1);

    await expect(
      submitImportReview(db.client, submitParams),
    ).rejects.toBeInstanceOf(ImportReviewSessionNotFoundError);

    const transactionsAfterRetry = await db.client.transaction.findMany();
    expect(transactionsAfterRetry).toHaveLength(1);
    expect(transactionsAfterRetry[0]?.id).toBe(transactionsAfterFirst[0]?.id);
  });

  it("rejects a duplicate row decision, inserting nothing and leaving the session and its rows fully intact", async () => {
    const account = await db.client.account.create({
      data: { name: "Duplicate Decision Account" },
    });
    const session = await db.client.importReviewSession.create({
      data: { accountId: account.id, invalidCount: 0 },
    });
    const row = await db.client.importReviewRow.create({
      data: {
        sessionId: session.id,
        rowNumber: 2,
        bookingDate: new Date("2026-01-01T00:00:00.000Z"),
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant: "groceries friday",
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shop A",
        name: "Groceries",
        title: "Friday",
        categoryId: null,
      },
    });

    await expect(
      submitImportReview(db.client, {
        sessionId: session.id,
        rows: [
          { rowId: row.id, categoryId: null, selectedMessage: "Friday" },
          { rowId: row.id, categoryId: null, selectedMessage: "Friday" },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidImportReviewDecisionsError);

    const transactions = await db.client.transaction.findMany();
    expect(transactions).toEqual([]);

    const persistedSession = await db.client.importReviewSession.findUnique({
      where: { id: session.id },
    });
    expect(persistedSession).not.toBeNull();

    const persistedRows = await db.client.importReviewRow.findMany({
      where: { sessionId: session.id },
    });
    expect(persistedRows).toHaveLength(1);
  });

  it("rejects an unknown row ID, inserting nothing and leaving the session and its rows fully intact", async () => {
    const account = await db.client.account.create({
      data: { name: "Unknown Row Account" },
    });
    const session = await db.client.importReviewSession.create({
      data: { accountId: account.id, invalidCount: 0 },
    });
    const row = await db.client.importReviewRow.create({
      data: {
        sessionId: session.id,
        rowNumber: 2,
        bookingDate: new Date("2026-01-01T00:00:00.000Z"),
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant: "groceries friday",
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shop A",
        name: "Groceries",
        title: "Friday",
        categoryId: null,
      },
    });

    await expect(
      submitImportReview(db.client, {
        sessionId: session.id,
        rows: [
          { rowId: row.id, categoryId: null, selectedMessage: "Friday" },
          {
            rowId: "row-does-not-exist",
            categoryId: null,
            selectedMessage: "?",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidImportReviewDecisionsError);

    const transactions = await db.client.transaction.findMany();
    expect(transactions).toEqual([]);

    const persistedSession = await db.client.importReviewSession.findUnique({
      where: { id: session.id },
    });
    expect(persistedSession).not.toBeNull();

    const persistedRows = await db.client.importReviewRow.findMany({
      where: { sessionId: session.id },
    });
    expect(persistedRows).toHaveLength(1);
  });

  it("rejects a rowId belonging to another live session without affecting either session", async () => {
    const accountA = await db.client.account.create({
      data: { name: "Session A Account" },
    });
    const accountB = await db.client.account.create({
      data: { name: "Session B Account" },
    });
    const sessionA = await db.client.importReviewSession.create({
      data: { accountId: accountA.id, invalidCount: 0 },
    });
    const sessionB = await db.client.importReviewSession.create({
      data: { accountId: accountB.id, invalidCount: 0 },
    });
    const rowA = await db.client.importReviewRow.create({
      data: {
        sessionId: sessionA.id,
        rowNumber: 2,
        bookingDate: new Date("2026-01-01T00:00:00.000Z"),
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant: "groceries friday",
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shop A",
        name: "Groceries",
        title: "Friday",
        categoryId: null,
      },
    });
    const rowB = await db.client.importReviewRow.create({
      data: {
        sessionId: sessionB.id,
        rowNumber: 5,
        bookingDate: new Date("2026-02-01T00:00:00.000Z"),
        amountNok: 250,
        currency: "NOK",
        normalizedMerchant: "fuel station",
        paymentType: PaymentType.CARD,
        sender: "Bob",
        recipient: "Shell",
        name: "Fuel",
        title: "Shell",
        categoryId: null,
      },
    });

    await expect(
      submitImportReview(db.client, {
        sessionId: sessionA.id,
        rows: [
          { rowId: rowA.id, categoryId: null, selectedMessage: "Friday" },
          { rowId: rowB.id, categoryId: null, selectedMessage: "Shell" },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidImportReviewDecisionsError);

    const transactions = await db.client.transaction.findMany();
    expect(transactions).toEqual([]);

    const persistedSessionA = await db.client.importReviewSession.findUnique({
      where: { id: sessionA.id },
    });
    expect(persistedSessionA).not.toBeNull();
    const persistedRowsA = await db.client.importReviewRow.findMany({
      where: { sessionId: sessionA.id },
    });
    expect(persistedRowsA).toHaveLength(1);

    const persistedSessionB = await db.client.importReviewSession.findUnique({
      where: { id: sessionB.id },
    });
    expect(persistedSessionB).not.toBeNull();
    const persistedRowsB = await db.client.importReviewRow.findMany({
      where: { sessionId: sessionB.id },
    });
    expect(persistedRowsB).toHaveLength(1);
  });

  it("succeeds for a unique subset of a session's rows, unaffected by the new validation", async () => {
    const account = await db.client.account.create({
      data: { name: "Valid Subset Account" },
    });
    const session = await db.client.importReviewSession.create({
      data: { accountId: account.id, invalidCount: 0 },
    });
    const row1 = await db.client.importReviewRow.create({
      data: {
        sessionId: session.id,
        rowNumber: 2,
        bookingDate: new Date("2026-01-01T00:00:00.000Z"),
        amountNok: 100,
        currency: "NOK",
        normalizedMerchant: "groceries friday",
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shop A",
        name: "Groceries",
        title: "Friday",
        categoryId: null,
      },
    });
    const row2 = await db.client.importReviewRow.create({
      data: {
        sessionId: session.id,
        rowNumber: 3,
        bookingDate: new Date("2026-01-02T00:00:00.000Z"),
        amountNok: 200,
        currency: "NOK",
        normalizedMerchant: "fuel station",
        paymentType: PaymentType.CARD,
        sender: "Alice",
        recipient: "Shell",
        name: "Fuel",
        title: "Shell",
        categoryId: null,
      },
    });

    const result = await submitImportReview(db.client, {
      sessionId: session.id,
      rows: [{ rowId: row1.id, categoryId: null, selectedMessage: "Friday" }],
    });

    expect(result.summary.imported).toBe(1);

    const transactions = await db.client.transaction.findMany({
      where: { accountId: account.id },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.normalizedMerchant).toBe(row1.normalizedMerchant);
    expect(
      transactions.some(
        (transaction) =>
          transaction.normalizedMerchant === row2.normalizedMerchant,
      ),
    ).toBe(false);

    const persistedSession = await db.client.importReviewSession.findUnique({
      where: { id: session.id },
    });
    expect(persistedSession).toBeNull();
  });

  it("reads the result's invalid count from the persisted session, not any caller input", async () => {
    const account = await db.client.account.create({
      data: { name: "Invalid Count Account" },
    });
    const session = await db.client.importReviewSession.create({
      data: { accountId: account.id, invalidCount: 7 },
    });

    const result = await submitImportReview(db.client, {
      sessionId: session.id,
      rows: [],
    });

    expect(result.summary.invalid).toBe(7);
    expect(result.summary.imported).toBe(0);
  });
});

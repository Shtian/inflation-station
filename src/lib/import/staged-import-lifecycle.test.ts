import { PaymentType } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stageParsedImportRows } from "./review-stage";
import {
  DuplicateImportReviewRowDecisionError,
  ImportReviewSessionNotFoundError,
  InvalidImportReviewCategoryError,
  submitImportReview,
  UnknownImportReviewRowDecisionError,
} from "./review-submit";
import {
  createStagedLifecycleTestDb,
  type TestPrismaClient,
} from "./test-support/staged-lifecycle-db";

/**
 * The staged import lifecycle (`stageParsedImportRows` + `submitImportReview`)
 * is exercised here against a real, migrated SQLite database rather than
 * mocks, because atomicity claims (a failed write leaves no partial state)
 * cannot be proven by a mock that always resolves its stubbed calls.
 */

const HEADER =
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype";

const stageOptions = { openAiCleanupEnabled: false };

function csvRow(
  overrides: Partial<{
    bookingDate: string;
    amountNok: string;
    sender: string;
    recipient: string;
    name: string;
    title: string;
    currency: string;
    paymentType: string;
  }> = {},
): string {
  const row = {
    bookingDate: "01.01.2026",
    amountNok: "100,00",
    sender: "Alice",
    recipient: "Shop A",
    name: "Groceries",
    title: "Friday",
    currency: "NOK",
    paymentType: "Kort",
    ...overrides,
  };

  return [
    row.bookingDate,
    row.amountNok,
    row.sender,
    row.recipient,
    row.name,
    row.title,
    row.currency,
    row.paymentType,
  ].join(";");
}

function buildCsv(rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

/** Replaces a nested tx-client method with one that always throws, without invoking the original implementation. */
function throwInsteadOf<T extends Record<string, unknown>>(
  tx: T,
  path: [string, string],
  error: Error,
): T {
  const [namespace, method] = path;
  const target = tx[namespace] as Record<string, unknown>;
  target[method] = async () => {
    throw error;
  };
  return tx;
}

/** Calls through to the real implementation, then throws — simulating a failure that happens after a prior write already queued in the same uncommitted transaction. */
function throwAfter<T extends Record<string, unknown>>(
  tx: T,
  path: [string, string],
  error: Error,
): T {
  const [namespace, method] = path;
  const target = tx[namespace] as Record<
    string,
    (...args: unknown[]) => unknown
  >;
  const original = target[method].bind(target);
  target[method] = async (...args: unknown[]) => {
    await original(...args);
    throw error;
  };
  return tx;
}

let db: TestPrismaClient;

beforeAll(() => {
  db = createStagedLifecycleTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

let accountCounter = 0;

async function createAccount() {
  accountCounter += 1;
  return db.prisma.account.create({
    data: { name: `Test Account ${accountCounter}` },
  });
}

async function stageSession(accountId: string, rows: string[]) {
  const staged = await stageParsedImportRows(
    // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
    db.prisma as any,
    { accountId, csvContent: buildCsv(rows) },
    stageOptions,
  );
  return staged.review;
}

describe("staged import lifecycle", () => {
  describe("stageParsedImportRows", () => {
    it("leaves no partial review session when staged-row persistence fails", async () => {
      const account = await createAccount();
      const failingDb = {
        ...db.prisma,
        $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
          db.prisma.$transaction((tx) =>
            fn(
              throwInsteadOf(
                tx as unknown as Record<string, unknown>,
                ["importReviewRow", "createMany"],
                new Error("staged-row persistence failed"),
              ),
            ),
          ),
      };

      await expect(
        stageParsedImportRows(
          // biome-ignore lint/suspicious/noExplicitAny: intentionally-failing test double for the lifecycle db-client type
          failingDb as any,
          { accountId: account.id, csvContent: buildCsv([csvRow()]) },
          stageOptions,
        ),
      ).rejects.toThrow("staged-row persistence failed");

      const sessions = await db.prisma.importReviewSession.findMany({
        where: { accountId: account.id },
      });
      const rows = await db.prisma.importReviewRow.findMany({
        where: { session: { accountId: account.id } },
      });
      expect(sessions).toHaveLength(0);
      expect(rows).toHaveLength(0);
    });

    it("returns a review whose persisted rows and server-owned invalid count match the staged session", async () => {
      const account = await createAccount();

      const result = await stageSessionResult(account.id, [
        csvRow(),
        csvRow({ bookingDate: "not-a-date" }),
      ]);

      expect(result.review.sessionId).not.toBeNull();
      const sessionId = result.review.sessionId as string;

      const persistedSession =
        await db.prisma.importReviewSession.findUniqueOrThrow({
          where: { id: sessionId },
        });
      const persistedRows = await db.prisma.importReviewRow.findMany({
        where: { sessionId },
      });

      expect(persistedRows).toHaveLength(1);
      expect(result.review.rows).toHaveLength(1);
      expect(persistedSession.invalidCount).toBe(1);
      expect(result.summary.invalid).toBe(1);
    });
  });

  describe("submitImportReview", () => {
    it("atomically consumes a session: inserts selected transactions and deletes the session", async () => {
      const account = await createAccount();
      const review = await stageSession(account.id, [csvRow()]);
      const sessionId = review.sessionId as string;
      const rowId = review.rows[0].id;

      const result = await submitImportReview(
        // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
        db.prisma as any,
        {
          sessionId,
          rows: [{ rowId, categoryId: null, selectedMessage: "Friday" }],
        },
      );

      expect(result.summary.imported).toBe(1);
      const transactions = await db.prisma.transaction.findMany({
        where: { accountId: account.id },
      });
      expect(transactions).toHaveLength(1);
      const session = await db.prisma.importReviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(session).toBeNull();
    });

    it("rejects retrying an already-consumed session and creates no additional transactions", async () => {
      const account = await createAccount();
      const review = await stageSession(account.id, [csvRow()]);
      const sessionId = review.sessionId as string;
      const rowId = review.rows[0].id;
      const payload = {
        sessionId,
        rows: [{ rowId, categoryId: null, selectedMessage: "Friday" }],
      };

      // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
      await submitImportReview(db.prisma as any, payload);

      await expect(
        // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
        submitImportReview(db.prisma as any, payload),
      ).rejects.toBeInstanceOf(ImportReviewSessionNotFoundError);

      const transactions = await db.prisma.transaction.findMany({
        where: { accountId: account.id },
      });
      expect(transactions).toHaveLength(1);
    });

    it("forces a failure after transaction insertion but before commit: no transactions added, session remains available", async () => {
      const account = await createAccount();
      const review = await stageSession(account.id, [csvRow()]);
      const sessionId = review.sessionId as string;
      const rowId = review.rows[0].id;

      const failingDb = {
        ...db.prisma,
        $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
          db.prisma.$transaction((tx) =>
            fn(
              throwAfter(
                tx as unknown as Record<string, unknown>,
                ["transaction", "createMany"],
                new Error("commit interrupted"),
              ),
            ),
          ),
      };

      await expect(
        submitImportReview(
          // biome-ignore lint/suspicious/noExplicitAny: intentionally-failing test double for the lifecycle db-client type
          failingDb as any,
          {
            sessionId,
            rows: [{ rowId, categoryId: null, selectedMessage: "Friday" }],
          },
        ),
      ).rejects.toThrow("commit interrupted");

      const transactions = await db.prisma.transaction.findMany({
        where: { accountId: account.id },
      });
      expect(transactions).toHaveLength(0);
      const session = await db.prisma.importReviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(session).not.toBeNull();
    });

    it("imports only the selected subset and discards unselected staged rows with the session", async () => {
      const account = await createAccount();
      const review = await stageSession(account.id, [
        csvRow(),
        csvRow({ title: "Saturday", bookingDate: "02.01.2026" }),
      ]);
      const sessionId = review.sessionId as string;
      const [rowOne] = review.rows;

      const result = await submitImportReview(
        // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
        db.prisma as any,
        {
          sessionId,
          rows: [
            {
              rowId: rowOne.id,
              categoryId: null,
              selectedMessage: rowOne.title,
            },
          ],
        },
      );

      expect(result.summary.imported).toBe(1);
      const transactions = await db.prisma.transaction.findMany({
        where: { accountId: account.id },
      });
      expect(transactions).toHaveLength(1);
      const remainingRows = await db.prisma.importReviewRow.findMany({
        where: { sessionId },
      });
      expect(remainingRows).toHaveLength(0);
      const session = await db.prisma.importReviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(session).toBeNull();
    });

    it("imports an explicitly selected potential-duplicate row", async () => {
      const account = await createAccount();
      await db.prisma.transaction.create({
        data: {
          accountId: account.id,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "groceries friday",
          paymentType: PaymentType.CARD,
        },
      });

      const review = await stageSession(account.id, [csvRow()]);
      expect(review.rows[0].potentialDuplicate).toBe(true);
      const sessionId = review.sessionId as string;
      const rowId = review.rows[0].id;

      const result = await submitImportReview(
        // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
        db.prisma as any,
        {
          sessionId,
          rows: [{ rowId, categoryId: null, selectedMessage: "Friday" }],
        },
      );

      expect(result.summary.imported).toBe(1);
      const transactions = await db.prisma.transaction.findMany({
        where: { accountId: account.id },
      });
      expect(transactions).toHaveLength(2);
    });

    it("rejects duplicate decision IDs for the same staged row without inserting or deleting", async () => {
      const account = await createAccount();
      const review = await stageSession(account.id, [csvRow()]);
      const sessionId = review.sessionId as string;
      const rowId = review.rows[0].id;

      await expect(
        submitImportReview(
          // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
          db.prisma as any,
          {
            sessionId,
            rows: [
              { rowId, categoryId: null, selectedMessage: "Friday" },
              { rowId, categoryId: null, selectedMessage: "Friday" },
            ],
          },
        ),
      ).rejects.toBeInstanceOf(DuplicateImportReviewRowDecisionError);

      const transactions = await db.prisma.transaction.findMany({
        where: { accountId: account.id },
      });
      expect(transactions).toHaveLength(0);
      const session = await db.prisma.importReviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(session).not.toBeNull();
    });

    it("rejects unknown row IDs without inserting or deleting", async () => {
      const account = await createAccount();
      const review = await stageSession(account.id, [csvRow()]);
      const sessionId = review.sessionId as string;

      await expect(
        submitImportReview(
          // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
          db.prisma as any,
          {
            sessionId,
            rows: [
              {
                rowId: "does-not-exist",
                categoryId: null,
                selectedMessage: "Friday",
              },
            ],
          },
        ),
      ).rejects.toBeInstanceOf(UnknownImportReviewRowDecisionError);

      const transactions = await db.prisma.transaction.findMany({
        where: { accountId: account.id },
      });
      expect(transactions).toHaveLength(0);
      const session = await db.prisma.importReviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(session).not.toBeNull();
    });

    it("rejects row IDs that belong to another session", async () => {
      const accountOne = await createAccount();
      const accountTwo = await createAccount();
      const reviewOne = await stageSession(accountOne.id, [csvRow()]);
      const reviewTwo = await stageSession(accountTwo.id, [csvRow()]);

      await expect(
        submitImportReview(
          // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
          db.prisma as any,
          {
            sessionId: reviewOne.sessionId as string,
            rows: [
              {
                rowId: reviewTwo.rows[0].id,
                categoryId: null,
                selectedMessage: "Friday",
              },
            ],
          },
        ),
      ).rejects.toBeInstanceOf(UnknownImportReviewRowDecisionError);

      const transactionsOne = await db.prisma.transaction.findMany({
        where: { accountId: accountOne.id },
      });
      expect(transactionsOne).toHaveLength(0);
      const sessionOne = await db.prisma.importReviewSession.findUnique({
        where: { id: reviewOne.sessionId as string },
      });
      expect(sessionOne).not.toBeNull();
    });

    it("rejects an invalid category decision without inserting or consuming the session", async () => {
      const account = await createAccount();
      const review = await stageSession(account.id, [csvRow()]);
      const sessionId = review.sessionId as string;
      const rowId = review.rows[0].id;

      await expect(
        submitImportReview(
          // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
          db.prisma as any,
          {
            sessionId,
            rows: [
              {
                rowId,
                categoryId: "does-not-exist",
                selectedMessage: "Friday",
              },
            ],
          },
        ),
      ).rejects.toBeInstanceOf(InvalidImportReviewCategoryError);

      const transactions = await db.prisma.transaction.findMany({
        where: { accountId: account.id },
      });
      expect(transactions).toHaveLength(0);
      const session = await db.prisma.importReviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(session).not.toBeNull();
    });

    it("derives the invalid summary count from server-owned staged state, not the submit request", async () => {
      const account = await createAccount();
      const review = await stageSession(account.id, [
        csvRow(),
        csvRow({ bookingDate: "not-a-date" }),
      ]);
      const sessionId = review.sessionId as string;
      const rowId = review.rows[0].id;

      const result = await submitImportReview(
        // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
        db.prisma as any,
        {
          sessionId,
          rows: [{ rowId, categoryId: null, selectedMessage: "Friday" }],
        },
      );

      expect(result.summary.invalid).toBe(1);
    });
  });
});

async function stageSessionResult(accountId: string, rows: string[]) {
  return stageParsedImportRows(
    // biome-ignore lint/suspicious/noExplicitAny: real PrismaClient structurally satisfies the narrower lifecycle db-client type
    db.prisma as any,
    { accountId, csvContent: buildCsv(rows) },
    stageOptions,
  );
}

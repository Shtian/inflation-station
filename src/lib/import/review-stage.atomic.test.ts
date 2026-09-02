import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  installFailureTrigger,
  removeFailureTrigger,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import { stageParsedImportRows } from "./review-stage";

const HEADER =
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype";

describe("stageParsedImportRows - atomic persistence (real database)", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  it("persists a complete review session and rows whose returned data matches persisted state", async () => {
    const account = await db.client.account.create({
      data: { name: "Atomic Staging Account" },
    });

    const csvContent = [
      HEADER,
      "01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
      "32.01.2026;50,00;Bob;Shop B;Snacks;Monday;NOK;Kort",
    ].join("\n");

    const result = await stageParsedImportRows(
      db.client,
      {
        accountId: account.id,
        csvContent,
      },
      {
        openAiApiKey: null,
      },
    );

    expect(result.review.sessionId).not.toBeNull();
    const sessionId = result.review.sessionId as string;

    const persistedSession = await db.client.importReviewSession.findUnique({
      where: { id: sessionId },
    });
    expect(persistedSession).not.toBeNull();
    expect(persistedSession?.accountId).toBe(account.id);
    expect(persistedSession?.invalidCount).toBe(result.summary.invalid);
    expect(persistedSession?.invalidCount).toBe(1);

    const persistedRows = await db.client.importReviewRow.findMany({
      where: { sessionId },
      orderBy: [{ bookingDate: "desc" }, { rowNumber: "asc" }],
    });

    expect(persistedRows).toHaveLength(result.review.rows.length);
    expect(persistedRows).toHaveLength(1);
    expect(persistedRows[0]?.rowNumber).toBe(result.review.rows[0]?.rowNumber);
    expect(persistedRows[0]?.id).toBe(result.review.rows[0]?.id);
    expect(
      Number.parseFloat(persistedRows[0]?.amountNok.toString() ?? "NaN"),
    ).toBe(result.review.rows[0]?.amountNok);
  });

  it("leaves no review session or staged rows when the staged-row persistence fails", async () => {
    const account = await db.client.account.create({
      data: { name: "Atomic Failure Account" },
    });

    const triggerName = await installFailureTrigger(db.client, {
      table: "ImportReviewRow",
      event: "INSERT",
      message: "forced staged row insert failure",
    });

    try {
      const csvContent = [
        HEADER,
        "01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
      ].join("\n");

      await expect(
        stageParsedImportRows(
          db.client,
          {
            accountId: account.id,
            csvContent,
          },
          {
            openAiApiKey: null,
          },
        ),
      ).rejects.toBeDefined();

      const sessions = await db.client.importReviewSession.findMany();
      expect(sessions).toEqual([]);

      const rows = await db.client.importReviewRow.findMany();
      expect(rows).toEqual([]);
    } finally {
      await removeFailureTrigger(db.client, triggerName);
    }
  });
});

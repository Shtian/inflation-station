import { PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { stageParsedImportRows } from "./review-stage";

const HEADER =
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype";

function createDbMock(options?: {
  stagedRows?: Array<{
    id: string;
    rowNumber: number;
    bookingDate: Date;
    amountNok: number;
    currency: string;
    normalizedMerchant: string;
    paymentType: PaymentType;
    sender: string;
    recipient: string;
    name: string;
    title: string;
    categoryId: string | null;
  }>;
}) {
  return {
    importReviewSession: {
      create: vi.fn(async () => ({ id: "session-1" })),
    },
    importReviewRow: {
      createMany: vi.fn(async () => ({
        count: options?.stagedRows?.length ?? 0,
      })),
      findMany: vi.fn(async () => options?.stagedRows ?? []),
    },
  };
}

describe("stageParsedImportRows", () => {
  it("stages valid rows and returns review payload with row identifiers", async () => {
    const db = createDbMock({
      stagedRows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "shop a alice groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      csvContent: `${HEADER}\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
    });

    expect(db.importReviewSession.create).toHaveBeenCalledWith({
      data: {
        accountId: "account-1",
      },
      select: {
        id: true,
      },
    });
    expect(db.importReviewRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          sessionId: "session-1",
          rowNumber: 2,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "shop a alice groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });

    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 0,
    });
    expect(result.review).toEqual({
      sessionId: "session-1",
      rows: [
        {
          id: "row-1",
          rowNumber: 2,
          bookingDate: "2026-01-01",
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "shop a alice groceries friday",
          paymentType: PaymentType.CARD,
          sender: "Alice",
          recipient: "Shop A",
          name: "Groceries",
          title: "Friday",
          categoryId: null,
        },
      ],
    });
  });

  it("keeps invalid booking dates out of staged rows and returns row-level validation errors", async () => {
    const db = createDbMock({ stagedRows: [] });

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      csvContent: `${HEADER}\n32.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort`,
    });

    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    });
    expect(result.errors).toEqual([
      {
        rowNumber: 2,
        code: "INVALID_BOOKING_DATE",
        message:
          'Row 2 has unsupported booking date "32.01.2026". Expected formats DD.MM.YYYY, YYYY-MM-DD, or YYYY/MM/DD.',
      },
    ]);
    expect(result.review).toEqual({
      sessionId: null,
      rows: [],
    });

    expect(db.importReviewSession.create).not.toHaveBeenCalled();
    expect(db.importReviewRow.createMany).not.toHaveBeenCalled();
  });

  it("returns parser diagnostics and skips staging when CSV has no data rows", async () => {
    const db = createDbMock();

    const result = await stageParsedImportRows(db, {
      accountId: "account-1",
      csvContent: "",
    });

    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    });
    expect(result.review).toEqual({
      sessionId: null,
      rows: [],
    });
    expect(db.importReviewSession.create).not.toHaveBeenCalled();
    expect(db.importReviewRow.createMany).not.toHaveBeenCalled();
  });
});

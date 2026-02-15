import { PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  AccountNotFoundError,
  importTransactionsFromCsv,
} from "./import-transactions";

const HEADER =
  "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype";

function createDbMock(options?: {
  accountExists?: boolean;
  existingTransactions?: Array<{
    bookingDate: Date;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: PaymentType;
  }>;
  createManyCount?: number;
}) {
  return {
    account: {
      findUnique: vi.fn(async () =>
        options?.accountExists === false ? null : { id: "account-1" },
      ),
    },
    transaction: {
      findMany: vi.fn(async () => options?.existingTransactions ?? []),
      createMany: vi.fn(async () => ({ count: options?.createManyCount ?? 0 })),
    },
  };
}

describe("importTransactionsFromCsv", () => {
  it("throws AccountNotFoundError when the selected account does not exist", async () => {
    const db = createDbMock({ accountExists: false });

    await expect(
      importTransactionsFromCsv(db, {
        accountId: "missing-account",
        csvContent: `${HEADER}\n01.01.2026;10,00;A;B;C;D;NOK;Kort`,
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);

    expect(db.transaction.findMany).not.toHaveBeenCalled();
    expect(db.transaction.createMany).not.toHaveBeenCalled();
  });

  it("returns parser diagnostics and skips DB writes when all rows are invalid", async () => {
    const db = createDbMock();

    const result = await importTransactionsFromCsv(db, {
      accountId: "account-1",
      csvContent: "",
    });

    expect(result.summary).toEqual({
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    });
    expect(result.errors).toHaveLength(1);
    expect(db.transaction.findMany).not.toHaveBeenCalled();
    expect(db.transaction.createMany).not.toHaveBeenCalled();
  });

  it("deduplicates batch and existing rows before insert and returns stable summary", async () => {
    const db = createDbMock({
      existingTransactions: [
        {
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          amountNok: 200,
          normalizedMerchant: "shop a alice groceries friday",
          paymentType: PaymentType.CARD,
        },
      ],
      createManyCount: 1,
    });

    const csv = [
      HEADER,
      "01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
      "01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
      "03.01.2026;200,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
    ].join("\n");

    const result = await importTransactionsFromCsv(db, {
      accountId: "account-1",
      csvContent: csv,
    });

    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 2,
      ignoredReserved: 0,
      invalid: 0,
    });

    expect(db.transaction.createMany).toHaveBeenCalledOnce();
    expect(db.transaction.createMany).toHaveBeenCalledWith({
      data: [
        {
          accountId: "account-1",
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          amountNok: 100,
          currency: "NOK",
          normalizedMerchant: "shop a alice groceries friday",
          paymentType: PaymentType.CARD,
        },
      ],
    });
  });

  it("preserves ignored and invalid counts from parser while importing valid rows", async () => {
    const db = createDbMock({ createManyCount: 1 });

    const csv = [
      HEADER,
      "Reservert;10,00;A;B;C;D;NOK;Kort",
      "02.01.2026;20,00;A;B;C;D;USD;Kort",
      "03.01.2026;30,00;A;B;C;D;NOK;Kort",
    ].join("\n");

    const result = await importTransactionsFromCsv(db, {
      accountId: "account-1",
      csvContent: csv,
    });

    expect(result.summary).toEqual({
      imported: 1,
      duplicates: 0,
      ignoredReserved: 1,
      invalid: 1,
    });
  });
});

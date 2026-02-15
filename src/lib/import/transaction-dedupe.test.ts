import { describe, expect, it } from "vitest";

import type { ParsedCsvRow } from "./csv-parser";
import {
  buildTransactionFingerprint,
  dedupeParsedTransactions,
} from "./transaction-dedupe";

function createRow(overrides: Partial<ParsedCsvRow> = {}): ParsedCsvRow {
  return {
    bookingDate: "01.02.2026",
    amountNok: 100,
    currency: "NOK",
    sender: "Alice",
    recipient: "Store",
    name: "Groceries",
    title: "Friday run",
    paymentType: "Kort",
    ...overrides,
  };
}

describe("buildTransactionFingerprint", () => {
  it("is deterministic for formatting differences in source values", () => {
    const first = buildTransactionFingerprint({
      accountId: " Main Account ",
      bookingDate: "01.02.2026",
      amountNok: 100,
      normalizedMerchant: "Store  As",
      paymentType: "Kort",
    });

    const second = buildTransactionFingerprint({
      accountId: "main account",
      bookingDate: "2026-02-01",
      amountNok: 100.0,
      normalizedMerchant: " store as ",
      paymentType: " KORT ",
    });

    expect(first).toBe(second);
  });
});

describe("dedupeParsedTransactions", () => {
  it("skips duplicates inside the same import batch and counts them", () => {
    const rows = [createRow(), createRow(), createRow({ amountNok: 250 })];

    const result = dedupeParsedTransactions("account-1", rows);

    expect(result.uniqueRows).toHaveLength(2);
    expect(result.duplicateCount).toBe(1);
  });

  it("skips rows that already exist by fingerprint and counts duplicates", () => {
    const row = createRow();
    const existingFingerprint = buildTransactionFingerprint({
      accountId: "account-1",
      bookingDate: row.bookingDate,
      amountNok: row.amountNok,
      normalizedMerchant: `${row.recipient} ${row.sender} ${row.name} ${row.title}`,
      paymentType: row.paymentType,
    });

    const result = dedupeParsedTransactions(
      "account-1",
      [row],
      new Set([existingFingerprint]),
    );

    expect(result.uniqueRows).toEqual([]);
    expect(result.duplicateCount).toBe(1);
  });
});

import { PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { parseTransactionUpdatePayload, updateTransaction } from "./update";

function createUpdateDbMock() {
  return {
    transaction: {
      update: vi.fn(async () => ({
        id: "tx-1",
        accountId: "acc-1",
        categoryId: "cat-1",
        bookingDate: new Date("2026-02-05T00:00:00.000Z"),
        amountNok: { toString: () => "-100.25" },
        currency: "NOK",
        normalizedMerchant: "updated shop",
        paymentType: PaymentType.CARD,
        createdAt: new Date("2026-02-01T10:00:00.000Z"),
        updatedAt: new Date("2026-02-06T09:00:00.000Z"),
      })),
    },
  };
}

describe("parseTransactionUpdatePayload", () => {
  it("accepts mutable fields and normalizes bookingDate", () => {
    const parsed = parseTransactionUpdatePayload({
      bookingDate: "2026-02-05",
      amountNok: -100.25,
      currency: "NOK",
      normalizedMerchant: "updated shop",
      paymentType: PaymentType.CARD,
      categoryId: "cat-1",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.bookingDate?.toISOString()).toBe(
      "2026-02-05T00:00:00.000Z",
    );
  });

  it("rejects immutable metadata fields", () => {
    const parsed = parseTransactionUpdatePayload({
      accountId: "acc-2",
      amountNok: -100.25,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(parsed.error.flatten().fieldErrors.accountId).toBeDefined();
  });
});

describe("updateTransaction", () => {
  it("updates and maps the persisted transaction row", async () => {
    const db = createUpdateDbMock();
    const parsed = parseTransactionUpdatePayload({
      amountNok: -100.25,
      normalizedMerchant: "updated shop",
      paymentType: PaymentType.CARD,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    const transaction = await updateTransaction(db, {
      transactionId: "tx-1",
      updates: parsed.data,
    });

    expect(db.transaction.update).toHaveBeenCalledWith({
      where: { id: "tx-1" },
      data: {
        amountNok: -100.25,
        normalizedMerchant: "updated shop",
        paymentType: PaymentType.CARD,
      },
      select: {
        id: true,
        accountId: true,
        categoryId: true,
        bookingDate: true,
        amountNok: true,
        currency: true,
        normalizedMerchant: true,
        paymentType: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(transaction).toEqual({
      id: "tx-1",
      accountId: "acc-1",
      categoryId: "cat-1",
      bookingDate: "2026-02-05",
      amountNok: -100.25,
      currency: "NOK",
      normalizedMerchant: "updated shop",
      paymentType: PaymentType.CARD,
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-02-06T09:00:00.000Z",
    });
  });
});

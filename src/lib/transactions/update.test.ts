import { PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { MAX_TRANSACTION_NOTE_LENGTH } from "./note";
import { parseTransactionUpdatePayload, updateTransaction } from "./update";

function createUpdateDbMock() {
  return {
    transaction: {
      update: vi.fn(async () => ({
        id: "tx-1",
        accountId: "acc-1",
        categoryId: "cat-1",
        category: {
          name: "Groceries",
        },
        bookingDate: new Date("2026-02-05T00:00:00.000Z"),
        amountNok: { toString: () => "-100.25" },
        currency: "NOK",
        normalizedMerchant: "updated shop",
        merchant: null,
        paymentType: PaymentType.CARD,
        note: "Monthly grocery refill",
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
      merchant: "updated shop",
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

  it("accepts nullable category updates", () => {
    const parsed = parseTransactionUpdatePayload({
      categoryId: null,
      amountNok: -100.25,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.categoryId).toBeNull();
  });

  it("accepts nullable note updates", () => {
    const parsed = parseTransactionUpdatePayload({
      amountNok: -100.25,
      note: null,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.note).toBeNull();
  });

  it("rejects note updates longer than 500 characters", () => {
    const parsed = parseTransactionUpdatePayload({
      amountNok: -100.25,
      note: "x".repeat(MAX_TRANSACTION_NOTE_LENGTH + 1),
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(parsed.error.flatten().fieldErrors.note).toBeDefined();
  });

  it("rejects currency updates", () => {
    const parsed = parseTransactionUpdatePayload({
      amountNok: -100.25,
      currency: "USD",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(
      parsed.error.issues.some((issue) => issue.message.includes("currency")),
    ).toBe(true);
  });
});

describe("updateTransaction", () => {
  it("updates and maps the persisted transaction row", async () => {
    const db = createUpdateDbMock();
    const parsed = parseTransactionUpdatePayload({
      categoryId: "cat-2",
      amountNok: -100.25,
      merchant: "updated shop",
      paymentType: PaymentType.CARD,
      note: "Monthly grocery refill",
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
        currency: "NOK",
        categoryId: "cat-2",
        amountNok: -100.25,
        merchant: "updated shop",
        paymentType: PaymentType.CARD,
        note: "Monthly grocery refill",
      },
      select: {
        id: true,
        accountId: true,
        categoryId: true,
        category: {
          select: {
            name: true,
          },
        },
        bookingDate: true,
        amountNok: true,
        currency: true,
        normalizedMerchant: true,
        merchant: true,
        paymentType: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(transaction).toEqual({
      id: "tx-1",
      accountId: "acc-1",
      categoryId: "cat-1",
      categoryName: "Groceries",
      bookingDate: "2026-02-05",
      amountNok: -100.25,
      currency: "NOK",
      normalizedMerchant: "updated shop",
      merchant: null,
      paymentType: PaymentType.CARD,
      note: "Monthly grocery refill",
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-02-06T09:00:00.000Z",
    });
  });
});

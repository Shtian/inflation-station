import { PaymentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createTransaction, parseTransactionCreatePayload } from "./create";
import { MAX_TRANSACTION_NOTE_LENGTH } from "./note";

function createDbMock() {
  return {
    transaction: {
      create: vi.fn(async () => ({
        id: "tx-new",
        accountId: "acc-1",
        categoryId: "cat-1",
        category: {
          name: "Groceries",
        },
        bookingDate: new Date("2026-03-01T00:00:00.000Z"),
        amountNok: { toString: () => "-50.00" },
        currency: "NOK",
        normalizedMerchant: "my shop",
        merchant: "My Shop",
        paymentType: PaymentType.CARD,
        note: "some note",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        updatedAt: new Date("2026-03-01T10:00:00.000Z"),
      })),
    },
  };
}

describe("parseTransactionCreatePayload", () => {
  it("accepts valid required fields", () => {
    const result = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "2026-03-01",
      amountNok: -50,
      merchant: "My Shop",
      paymentType: PaymentType.CARD,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.accountId).toBe("acc-1");
    expect(result.data.bookingDate.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(result.data.amountNok).toBe(-50);
    expect(result.data.merchant).toBe("My Shop");
    expect(result.data.paymentType).toBe(PaymentType.CARD);
  });

  it("accepts optional categoryId and note", () => {
    const result = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "2026-03-01",
      amountNok: 100,
      merchant: "Shop",
      paymentType: PaymentType.EFT,
      categoryId: "cat-1",
      note: "A note",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.categoryId).toBe("cat-1");
    expect(result.data.note).toBe("A note");
  });

  it("accepts omitted optional fields", () => {
    const result = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "2026-03-01",
      amountNok: 100,
      merchant: "Shop",
      paymentType: PaymentType.CARD,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.categoryId).toBeUndefined();
    expect(result.data.note).toBeUndefined();
  });

  it("accepts negative amountNok", () => {
    const result = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "2026-03-01",
      amountNok: -999.99,
      merchant: "Shop",
      paymentType: PaymentType.CARD,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.amountNok).toBe(-999.99);
  });

  it("rejects missing accountId", () => {
    const result = parseTransactionCreatePayload({
      bookingDate: "2026-03-01",
      amountNok: 100,
      merchant: "Shop",
      paymentType: PaymentType.CARD,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.flatten().fieldErrors.accountId).toBeDefined();
  });

  it("rejects empty merchant", () => {
    const result = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "2026-03-01",
      amountNok: 100,
      merchant: "  ",
      paymentType: PaymentType.CARD,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.flatten().fieldErrors.merchant).toBeDefined();
  });

  it("rejects invalid bookingDate format", () => {
    const result = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "01/03/2026",
      amountNok: 100,
      merchant: "Shop",
      paymentType: PaymentType.CARD,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.flatten().fieldErrors.bookingDate).toBeDefined();
  });

  it("rejects note longer than max length", () => {
    const result = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "2026-03-01",
      amountNok: 100,
      merchant: "Shop",
      paymentType: PaymentType.CARD,
      note: "x".repeat(MAX_TRANSACTION_NOTE_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.flatten().fieldErrors.note).toBeDefined();
  });

  it("rejects normalizedMerchant from client", () => {
    const result = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "2026-03-01",
      amountNok: 100,
      merchant: "Shop",
      paymentType: PaymentType.CARD,
      normalizedMerchant: "shop",
    });

    expect(result.success).toBe(false);
  });

  it("rejects currency from client", () => {
    const result = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "2026-03-01",
      amountNok: 100,
      merchant: "Shop",
      paymentType: PaymentType.CARD,
      currency: "USD",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(
      result.error.issues.some((issue) => issue.message.includes("currency")),
    ).toBe(true);
  });
});

describe("createTransaction", () => {
  it("creates and maps the persisted transaction row", async () => {
    const db = createDbMock();
    const parsed = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "2026-03-01",
      amountNok: -50,
      merchant: "My Shop",
      paymentType: PaymentType.CARD,
      categoryId: "cat-1",
      note: "some note",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const transaction = await createTransaction(db, parsed.data);

    expect(db.transaction.create).toHaveBeenCalledWith({
      data: {
        accountId: "acc-1",
        bookingDate: new Date("2026-03-01T00:00:00.000Z"),
        amountNok: -50,
        merchant: "My Shop",
        normalizedMerchant: "my shop",
        currency: "NOK",
        paymentType: PaymentType.CARD,
        categoryId: "cat-1",
        note: "some note",
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
      id: "tx-new",
      accountId: "acc-1",
      categoryId: "cat-1",
      categoryName: "Groceries",
      bookingDate: "2026-03-01",
      amountNok: -50,
      currency: "NOK",
      normalizedMerchant: "my shop",
      merchant: "My Shop",
      paymentType: PaymentType.CARD,
      note: "some note",
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    });
  });

  it("derives normalizedMerchant as trimmed lowercase merchant", async () => {
    const db = createDbMock();
    const parsed = parseTransactionCreatePayload({
      accountId: "acc-1",
      bookingDate: "2026-03-01",
      amountNok: 100,
      merchant: "  My SHOP  ",
      paymentType: PaymentType.CARD,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    await createTransaction(db, parsed.data);

    expect(db.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          normalizedMerchant: "my shop",
          merchant: "My SHOP",
        }),
      }),
    );
  });
});

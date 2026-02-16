import { PaymentType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";

const {
  prismaMock,
  parseTransactionUpdatePayloadMock,
  updateTransactionMock,
  deleteTransactionMock,
} = vi.hoisted(() => ({
  prismaMock: { _tag: "prisma-mock" },
  parseTransactionUpdatePayloadMock: vi.fn(),
  updateTransactionMock: vi.fn(),
  deleteTransactionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/transactions/update", () => ({
  parseTransactionUpdatePayload: parseTransactionUpdatePayloadMock,
  updateTransaction: updateTransactionMock,
}));

vi.mock("@/lib/transactions/delete", () => ({
  deleteTransaction: deleteTransactionMock,
}));

describe("PATCH /api/transactions/[transactionId]", () => {
  beforeEach(() => {
    parseTransactionUpdatePayloadMock.mockReset();
    updateTransactionMock.mockReset();
  });

  it("returns 400 when transactionId route param is invalid", async () => {
    const response = await PATCH(new Request("http://localhost"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_TRANSACTION_ID",
    });
    expect(updateTransactionMock).not.toHaveBeenCalled();
  });

  it("returns 400 when update payload is invalid", async () => {
    parseTransactionUpdatePayloadMock.mockReturnValue({
      success: false,
      error: {
        flatten: () => ({ fieldErrors: { paymentType: ["Required"] } }),
      },
    });

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ paymentType: "INVALID" }),
        headers: { "Content-Type": "application/json" },
      }),
      {
        params: Promise.resolve({ transactionId: "tx-1" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_TRANSACTION_UPDATE_PAYLOAD",
      details: { fieldErrors: { paymentType: ["Required"] } },
    });
    expect(updateTransactionMock).not.toHaveBeenCalled();
  });

  it("persists valid updates and returns the updated transaction", async () => {
    parseTransactionUpdatePayloadMock.mockReturnValue({
      success: true,
      data: {
        categoryId: "cat-1",
        paymentType: PaymentType.CARD,
        normalizedMerchant: "Store",
      },
    });
    updateTransactionMock.mockResolvedValue({
      id: "tx-1",
      accountId: "acc-1",
      categoryId: null,
      bookingDate: "2026-02-01",
      amountNok: -100,
      currency: "NOK",
      normalizedMerchant: "Store",
      paymentType: PaymentType.CARD,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
    });

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          categoryId: "cat-1",
          paymentType: PaymentType.CARD,
          normalizedMerchant: "Store",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      {
        params: Promise.resolve({ transactionId: "tx-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateTransactionMock).toHaveBeenCalledWith(prismaMock, {
      transactionId: "tx-1",
      updates: {
        categoryId: "cat-1",
        paymentType: PaymentType.CARD,
        normalizedMerchant: "Store",
      },
    });
    await expect(response.json()).resolves.toEqual({
      transaction: {
        id: "tx-1",
        accountId: "acc-1",
        categoryId: null,
        bookingDate: "2026-02-01",
        amountNok: -100,
        currency: "NOK",
        normalizedMerchant: "Store",
        paymentType: PaymentType.CARD,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    });
  });
});

describe("DELETE /api/transactions/[transactionId]", () => {
  beforeEach(() => {
    deleteTransactionMock.mockReset();
  });

  it("returns 404 when transaction does not exist", async () => {
    deleteTransactionMock.mockRejectedValue({ code: "P2025" });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ transactionId: "missing-id" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "TRANSACTION_NOT_FOUND",
    });
  });

  it("deletes transaction and returns 204", async () => {
    deleteTransactionMock.mockResolvedValue(undefined);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ transactionId: "tx-1" }),
    });

    expect(response.status).toBe(204);
    expect(deleteTransactionMock).toHaveBeenCalledWith(prismaMock, "tx-1");
  });
});

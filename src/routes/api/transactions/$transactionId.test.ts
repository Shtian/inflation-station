import { PaymentType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeHandler } from "../-route-handler";
import { Route } from "./$transactionId";

const DELETE = routeHandler(Route, "DELETE");
const PATCH = routeHandler(Route, "PATCH");

const {
  prismaMock,
  parseTransactionUpdatePayloadMock,
  updateTransactionMock,
  findMissingUpdateReferenceMock,
  deleteTransactionMock,
} = vi.hoisted(() => ({
  prismaMock: { _tag: "prisma-mock" },
  parseTransactionUpdatePayloadMock: vi.fn(),
  updateTransactionMock: vi.fn(),
  findMissingUpdateReferenceMock: vi.fn(),
  deleteTransactionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/transactions/write", () => ({
  parseTransactionUpdatePayload: parseTransactionUpdatePayloadMock,
  updateTransaction: updateTransactionMock,
  findMissingUpdateReference: findMissingUpdateReferenceMock,
}));

vi.mock("@/lib/transactions/delete", () => ({
  deleteTransaction: deleteTransactionMock,
}));

describe("PATCH /api/transactions/[transactionId]", () => {
  beforeEach(() => {
    parseTransactionUpdatePayloadMock.mockReset();
    updateTransactionMock.mockReset();
    findMissingUpdateReferenceMock.mockReset();
    findMissingUpdateReferenceMock.mockResolvedValue("category");
  });

  it("returns 400 when transactionId route param is invalid", async () => {
    const response = await PATCH(new Request("http://localhost"), {});

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_TRANSACTION_ID",
      message: "Ugyldig transaksjons-ID.",
    });
    expect(updateTransactionMock).not.toHaveBeenCalled();
  });

  it("returns 400 when update payload is invalid", async () => {
    parseTransactionUpdatePayloadMock.mockReturnValue({
      success: false,
      error: {
        flatten: () => ({
          formErrors: [],
          fieldErrors: { paymentType: ["Required"] },
        }),
      },
    });

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ paymentType: "INVALID" }),
        headers: { "Content-Type": "application/json" },
      }),
      { transactionId: "tx-1" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_TRANSACTION_UPDATE_PAYLOAD",
      message:
        "Ugyldige data for oppdatering av transaksjon. paymentType: Required",
      details: { formErrors: [], fieldErrors: { paymentType: ["Required"] } },
    });
    expect(updateTransactionMock).not.toHaveBeenCalled();
  });

  it("persists valid updates and returns the updated transaction id", async () => {
    parseTransactionUpdatePayloadMock.mockReturnValue({
      success: true,
      data: {
        categoryId: "cat-1",
        paymentType: PaymentType.CARD,
        merchant: "Store",
      },
    });
    updateTransactionMock.mockResolvedValue({ id: "tx-1" });

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          categoryId: "cat-1",
          paymentType: PaymentType.CARD,
          merchant: "Store",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { transactionId: "tx-1" },
    );

    expect(response.status).toBe(200);
    expect(updateTransactionMock).toHaveBeenCalledWith(prismaMock, {
      transactionId: "tx-1",
      updates: {
        categoryId: "cat-1",
        paymentType: PaymentType.CARD,
        merchant: "Store",
      },
    });
    await expect(response.json()).resolves.toEqual({ id: "tx-1" });
  });

  it.each([
    ["P2025", 404, "TRANSACTION_NOT_FOUND", "Fant ikke transaksjonen."],
    ["P2003", 404, "CATEGORY_NOT_FOUND", "Fant ikke den valgte kategorien."],
  ])("maps a rejected update with code %s to %i %s", async (code, status, error, message) => {
    parseTransactionUpdatePayloadMock.mockReturnValue({
      success: true,
      data: { merchant: "Store" },
    });
    updateTransactionMock.mockRejectedValue({ code });

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ merchant: "Store" }),
        headers: { "Content-Type": "application/json" },
      }),
      { transactionId: "tx-1" },
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error, message });
  });

  it("maps a foreign-key failure on a missing trip to 404 TRIP_NOT_FOUND", async () => {
    parseTransactionUpdatePayloadMock.mockReturnValue({
      success: true,
      data: { tripId: "gone" },
    });
    updateTransactionMock.mockRejectedValue({ code: "P2003" });
    findMissingUpdateReferenceMock.mockResolvedValue("trip");

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ tripId: "gone" }),
        headers: { "Content-Type": "application/json" },
      }),
      { transactionId: "tx-1" },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "TRIP_NOT_FOUND",
      message: "Fant ikke den valgte turen.",
    });
  });

  it("rethrows unknown update errors", async () => {
    parseTransactionUpdatePayloadMock.mockReturnValue({
      success: true,
      data: { merchant: "Store" },
    });
    updateTransactionMock.mockRejectedValue(new Error("boom"));

    await expect(
      PATCH(
        new Request("http://localhost", {
          method: "PATCH",
          body: JSON.stringify({ merchant: "Store" }),
          headers: { "Content-Type": "application/json" },
        }),
        { transactionId: "tx-1" },
      ),
    ).rejects.toThrow("boom");
  });

  it("no longer maps P2002; the dedupe unique index was dropped", async () => {
    parseTransactionUpdatePayloadMock.mockReturnValue({
      success: true,
      data: { merchant: "Store" },
    });
    updateTransactionMock.mockRejectedValue({ code: "P2002" });

    await expect(
      PATCH(
        new Request("http://localhost", {
          method: "PATCH",
          body: JSON.stringify({ merchant: "Store" }),
          headers: { "Content-Type": "application/json" },
        }),
        { transactionId: "tx-1" },
      ),
    ).rejects.toEqual({ code: "P2002" });
  });
});

describe("DELETE /api/transactions/[transactionId]", () => {
  beforeEach(() => {
    deleteTransactionMock.mockReset();
  });

  it("returns 404 when transaction does not exist", async () => {
    deleteTransactionMock.mockRejectedValue({ code: "P2025" });

    const response = await DELETE(new Request("http://localhost"), {
      transactionId: "missing-id",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "TRANSACTION_NOT_FOUND",
      message: "Fant ikke transaksjonen.",
    });
  });

  it("deletes transaction and returns 204", async () => {
    deleteTransactionMock.mockResolvedValue(undefined);

    const response = await DELETE(new Request("http://localhost"), {
      transactionId: "tx-1",
    });

    expect(response.status).toBe(204);
    expect(deleteTransactionMock).toHaveBeenCalledWith(prismaMock, "tx-1");
  });
});

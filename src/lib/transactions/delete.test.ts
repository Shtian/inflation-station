import { describe, expect, it, vi } from "vitest";
import { deleteTransaction, deleteTransactions } from "./delete";

describe("deleteTransaction", () => {
  it("hard-deletes transaction by id", async () => {
    const db = {
      transaction: {
        delete: vi.fn(async () => ({ id: "tx-1" })),
      },
    };

    await deleteTransaction(db, "tx-1");

    expect(db.transaction.delete).toHaveBeenCalledWith({
      where: { id: "tx-1" },
    });
  });
});

describe("deleteTransactions", () => {
  it("bulk-deletes transactions by ids and returns count", async () => {
    const db = {
      transaction: {
        deleteMany: vi.fn(async () => ({ count: 3 })),
      },
    };

    const result = await deleteTransactions(db, ["tx-1", "tx-2", "tx-3"]);

    expect(db.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tx-1", "tx-2", "tx-3"] } },
    });
    expect(result).toBe(3);
  });

  it("throws when ids array is empty", async () => {
    const db = {
      transaction: {
        deleteMany: vi.fn(),
      },
    };

    await expect(deleteTransactions(db, [])).rejects.toThrow(
      "ids must be a non-empty array",
    );
    expect(db.transaction.deleteMany).not.toHaveBeenCalled();
  });
});

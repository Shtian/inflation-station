import { describe, expect, it, vi } from "vitest";
import { deleteTransaction } from "./delete";

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

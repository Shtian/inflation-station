import { describe, expect, it } from "vite-plus/test";
import { isTransfer } from "./transfer";

describe("isTransfer", () => {
  it("treats an uncategorized transaction as not a transfer", () => {
    expect(isTransfer({ category: null })).toBe(false);
  });

  it("treats a TRANSFER-kind category as a transfer", () => {
    expect(isTransfer({ category: { kind: "TRANSFER" } })).toBe(true);
  });

  it("treats an EXPENSE-kind category as not a transfer", () => {
    expect(isTransfer({ category: { kind: "EXPENSE" } })).toBe(false);
  });
});

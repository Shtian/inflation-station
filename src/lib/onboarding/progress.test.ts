import { describe, expect, it } from "vitest";
import { resolveCurrentStep, type SetupSnapshot } from "./progress";

const dnb = { name: "Brukskonto", institution: "DNB" };
const groceries = {
  name: "Dagligvarer",
  kind: "EXPENSE" as const,
  classifierHint: "Rema, Kiwi, Coop",
};
const salary = { name: "Lønn", kind: "INCOME" as const, classifierHint: null };
const transfers = {
  name: "Overføringer",
  kind: "TRANSFER" as const,
  classifierHint: null,
};

function snapshot(
  accounts: SetupSnapshot["accounts"],
  categories: SetupSnapshot["categories"],
): SetupSnapshot {
  return { accounts, categories };
}

describe("resolveCurrentStep", () => {
  it("starts at accounts on an empty setup", () => {
    expect(resolveCurrentStep(snapshot([], []))).toBe("accounts");
  });

  it("stays on accounts while categories exist but no account does", () => {
    expect(resolveCurrentStep(snapshot([], [groceries, transfers]))).toBe(
      "accounts",
    );
  });

  it("moves to categories once an account exists", () => {
    expect(resolveCurrentStep(snapshot([dnb], []))).toBe("categories");
  });

  it("does not count a transfer category as a spending category", () => {
    expect(resolveCurrentStep(snapshot([dnb], [transfers]))).toBe("categories");
  });

  it("moves to transfer once an expense category exists", () => {
    expect(resolveCurrentStep(snapshot([dnb], [groceries]))).toBe("transfer");
  });

  it("counts an income category as a regular category", () => {
    expect(resolveCurrentStep(snapshot([dnb], [salary]))).toBe("transfer");
  });

  it("is done with an account, a regular category, and a transfer category", () => {
    expect(resolveCurrentStep(snapshot([dnb], [groceries, transfers]))).toBe(
      "done",
    );
  });
});

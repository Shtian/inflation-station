import { describe, expect, it } from "vitest";
import { MAX_TRANSACTION_NOTE_LENGTH } from "@/lib/transactions/note";
import {
  buildInitialAddForm,
  isFutureDate,
  validateAddForm,
} from "./add-transaction-form";
import { UNCATEGORIZED_VALUE } from "./transactions-manager.types";

function baseForm() {
  return {
    accountId: "acc-1",
    categoryId: "__uncategorized__",
    bookingDate: "2026-03-29",
    amountNok: "100",
    merchant: "My Shop",
    paymentType: "OTHER" as const,
    note: "",
  };
}

describe("validateAddForm", () => {
  it("returns valid result for a correct form", () => {
    const result = validateAddForm(baseForm());

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.accountId).toBe("acc-1");
    expect(result.bookingDate).toBe("2026-03-29");
    expect(result.amountNok).toBe(100);
    expect(result.merchant).toBe("My Shop");
    expect(result.note).toBe("");
  });

  it("accepts negative amounts", () => {
    const result = validateAddForm({ ...baseForm(), amountNok: "-42.50" });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.amountNok).toBe(-42.5);
  });

  it("accepts amounts with comma as decimal separator", () => {
    const result = validateAddForm({ ...baseForm(), amountNok: "1,50" });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.amountNok).toBe(1.5);
  });

  it("trims whitespace from text fields before validation", () => {
    const result = validateAddForm({
      ...baseForm(),
      accountId: "  acc-1  ",
      merchant: "  My Shop  ",
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.accountId).toBe("acc-1");
    expect(result.merchant).toBe("My Shop");
  });

  it("rejects empty accountId", () => {
    const result = validateAddForm({ ...baseForm(), accountId: "" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toBe("Account is required.");
  });

  it("rejects whitespace-only accountId", () => {
    const result = validateAddForm({ ...baseForm(), accountId: "   " });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toBe("Account is required.");
  });

  it("rejects empty bookingDate", () => {
    const result = validateAddForm({ ...baseForm(), bookingDate: "" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toContain("Date");
  });

  it("rejects empty merchant", () => {
    const result = validateAddForm({ ...baseForm(), merchant: "" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toContain("merchant");
  });

  it("rejects non-numeric amountNok", () => {
    const result = validateAddForm({ ...baseForm(), amountNok: "abc" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toBe("Amount must be a valid number.");
  });

  it("rejects empty amountNok", () => {
    const result = validateAddForm({ ...baseForm(), amountNok: "" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toBe("Amount must be a valid number.");
  });

  it("rejects note exceeding max length", () => {
    const result = validateAddForm({
      ...baseForm(),
      note: "a".repeat(MAX_TRANSACTION_NOTE_LENGTH + 1),
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/500/);
  });

  it("accepts note at exact max length", () => {
    const result = validateAddForm({
      ...baseForm(),
      note: "a".repeat(MAX_TRANSACTION_NOTE_LENGTH),
    });
    expect(result.valid).toBe(true);
  });
});

describe("buildInitialAddForm", () => {
  it("returns empty accountId when no accountId filter", () => {
    const form = buildInitialAddForm({
      accountId: "",
      categoryId: "",
      dateFrom: "",
    });
    expect(form.accountId).toBe("");
  });

  it("pre-fills accountId from active filter", () => {
    const form = buildInitialAddForm({
      accountId: "acc-1",
      categoryId: "",
      dateFrom: "",
    });
    expect(form.accountId).toBe("acc-1");
  });

  it("returns UNCATEGORIZED_VALUE when no categoryId filter", () => {
    const form = buildInitialAddForm({
      accountId: "",
      categoryId: "",
      dateFrom: "",
    });
    expect(form.categoryId).toBe(UNCATEGORIZED_VALUE);
  });

  it("pre-fills categoryId from active filter", () => {
    const form = buildInitialAddForm({
      accountId: "",
      categoryId: "cat-1",
      dateFrom: "",
    });
    expect(form.categoryId).toBe("cat-1");
  });

  it("returns empty bookingDate when no dateFrom filter", () => {
    const form = buildInitialAddForm({
      accountId: "",
      categoryId: "",
      dateFrom: "",
    });
    expect(form.bookingDate).toBe("");
  });

  it("pre-fills bookingDate from dateFrom filter", () => {
    const form = buildInitialAddForm({
      accountId: "",
      categoryId: "",
      dateFrom: "2026-03-01",
    });
    expect(form.bookingDate).toBe("2026-03-01");
  });

  it("returns all other fields with empty/default values", () => {
    const form = buildInitialAddForm({
      accountId: "",
      categoryId: "",
      dateFrom: "",
    });
    expect(form.amountNok).toBe("");
    expect(form.merchant).toBe("");
    expect(form.paymentType).toBe("OTHER");
    expect(form.note).toBe("");
  });
});

describe("isFutureDate", () => {
  it("returns true for a clearly future date", () => {
    expect(isFutureDate("2099-01-01")).toBe(true);
  });

  it("returns false for a clearly past date", () => {
    expect(isFutureDate("2020-01-01")).toBe(false);
  });

  it("returns false for today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isFutureDate(today)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isFutureDate("")).toBe(false);
  });
});

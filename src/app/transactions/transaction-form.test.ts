import { describe, expect, it } from "vitest";
import {
  buildInitialAddForm,
  isFutureDate,
  validateAddForm,
  validateTransactionFields,
} from "./transaction-form";
import type { EditFormState } from "./transactions-manager.types";
import { UNCATEGORIZED_VALUE } from "./transactions-manager.types";

function baseFields(): EditFormState {
  return {
    categoryId: "__uncategorized__",
    bookingDate: "2026-03-29",
    amountNok: "100",
    merchant: "My Shop",
    paymentType: "OTHER",
    note: "",
  };
}

describe("validateTransactionFields", () => {
  it("returns valid result for a correct form", () => {
    const result = validateTransactionFields(baseFields());

    expect(result).toEqual({
      valid: true,
      bookingDate: "2026-03-29",
      amountNok: 100,
      merchant: "My Shop",
      note: null,
    });
  });

  it("accepts negative amounts", () => {
    const result = validateTransactionFields({
      ...baseFields(),
      amountNok: "-42.50",
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.amountNok).toBe(-42.5);
  });

  it("accepts amounts with comma as decimal separator", () => {
    const result = validateTransactionFields({
      ...baseFields(),
      amountNok: "1,50",
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.amountNok).toBe(1.5);
  });

  it("trims whitespace from the merchant before validation", () => {
    const result = validateTransactionFields({
      ...baseFields(),
      merchant: "  My Shop  ",
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.merchant).toBe("My Shop");
  });

  it("rejects empty bookingDate", () => {
    const result = validateTransactionFields({
      ...baseFields(),
      bookingDate: "",
    });
    expect(result).toEqual({
      valid: false,
      error: "Date and merchant are required.",
    });
  });

  it("rejects empty merchant", () => {
    const result = validateTransactionFields({ ...baseFields(), merchant: "" });
    expect(result).toEqual({
      valid: false,
      error: "Date and merchant are required.",
    });
  });

  it("rejects non-numeric amountNok", () => {
    const result = validateTransactionFields({
      ...baseFields(),
      amountNok: "abc",
    });
    expect(result).toEqual({
      valid: false,
      error: "Amount must be a valid number.",
    });
  });

  it("rejects empty amountNok", () => {
    const result = validateTransactionFields({
      ...baseFields(),
      amountNok: "",
    });
    expect(result).toEqual({
      valid: false,
      error: "Amount must be a valid number.",
    });
  });

  it("reports a missing date or merchant before an unparseable amount", () => {
    const result = validateTransactionFields({
      ...baseFields(),
      amountNok: "abc",
      merchant: "",
    });
    expect(result).toEqual({
      valid: false,
      error: "Date and merchant are required.",
    });
  });

  it("rejects note exceeding max length", () => {
    const result = validateTransactionFields({
      ...baseFields(),
      note: "a".repeat(501),
    });
    expect(result).toEqual({
      valid: false,
      error: "Note must be 500 characters or fewer.",
    });
  });

  it("accepts note at exact max length", () => {
    const result = validateTransactionFields({
      ...baseFields(),
      note: "a".repeat(500),
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.note).toBe("a".repeat(500));
  });

  it("accepts a max-length note padded with whitespace and trims it", () => {
    const result = validateTransactionFields({
      ...baseFields(),
      note: `  ${"a".repeat(500)}  `,
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.note).toBe("a".repeat(500));
  });

  it("reads a whitespace-only note as no note", () => {
    const result = validateTransactionFields({ ...baseFields(), note: "   " });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.note).toBe(null);
  });
});

describe("validateAddForm", () => {
  it("returns the account alongside the parsed fields", () => {
    const result = validateAddForm({ ...baseFields(), accountId: "acc-1" });

    expect(result).toEqual({
      valid: true,
      accountId: "acc-1",
      bookingDate: "2026-03-29",
      amountNok: 100,
      merchant: "My Shop",
      note: null,
    });
  });

  it("rejects empty accountId", () => {
    const result = validateAddForm({ ...baseFields(), accountId: "" });
    expect(result).toEqual({ valid: false, error: "Account is required." });
  });

  it("rejects whitespace-only accountId", () => {
    const result = validateAddForm({ ...baseFields(), accountId: "   " });
    expect(result).toEqual({ valid: false, error: "Account is required." });
  });

  it("trims whitespace from accountId", () => {
    const result = validateAddForm({
      ...baseFields(),
      accountId: "  acc-1  ",
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.accountId).toBe("acc-1");
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

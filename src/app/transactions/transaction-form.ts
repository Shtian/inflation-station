import { readNoteField } from "@/lib/transactions/note";
import {
  type AddFormState,
  type EditFormState,
  UNCATEGORIZED_VALUE,
} from "./transactions-manager.types";

type ValidTransactionFields = {
  valid: true;
  bookingDate: string;
  amountNok: number;
  merchant: string;
  note: string | null;
};

type InvalidForm = {
  valid: false;
  error: string;
};

export type TransactionFieldsValidationResult =
  | ValidTransactionFields
  | InvalidForm;

export type AddFormValidationResult =
  | (ValidTransactionFields & { accountId: string })
  | InvalidForm;

type InitialFormFilters = {
  accountId: string;
  categoryId: string;
  dateFrom: string;
};

export function buildInitialAddForm(filters: InitialFormFilters): AddFormState {
  return {
    accountId: filters.accountId,
    categoryId: filters.categoryId || UNCATEGORIZED_VALUE,
    bookingDate: filters.dateFrom,
    amountNok: "",
    merchant: "",
    paymentType: "OTHER",
    note: "",
  };
}

export function isFutureDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr > today;
}

export function validateTransactionFields(
  form: EditFormState,
): TransactionFieldsValidationResult {
  const bookingDate = form.bookingDate.trim();
  const merchant = form.merchant.trim();
  if (!bookingDate || !merchant) {
    return { valid: false, error: "Date and merchant are required." };
  }

  const amountNok = Number.parseFloat(form.amountNok.replace(",", "."));
  if (!Number.isFinite(amountNok)) {
    return { valid: false, error: "Amount must be a valid number." };
  }

  const note = readNoteField(form.note);
  if (note.error) {
    return { valid: false, error: note.error };
  }

  return { valid: true, bookingDate, amountNok, merchant, note: note.value };
}

export function validateAddForm(form: AddFormState): AddFormValidationResult {
  const accountId = form.accountId.trim();
  if (!accountId) {
    return { valid: false, error: "Account is required." };
  }

  const fields = validateTransactionFields(form);
  if (!fields.valid) {
    return fields;
  }

  return { ...fields, accountId };
}

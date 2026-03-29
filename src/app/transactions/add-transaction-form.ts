import {
  MAX_TRANSACTION_NOTE_LENGTH,
  MAX_TRANSACTION_NOTE_LENGTH_MESSAGE,
} from "@/lib/transactions/note";
import type { AddFormState } from "./transactions-manager.types";

type ValidAddForm = {
  valid: true;
  accountId: string;
  bookingDate: string;
  amountNok: number;
  merchant: string;
  note: string;
};

type InvalidAddForm = {
  valid: false;
  error: string;
};

export type AddFormValidationResult = ValidAddForm | InvalidAddForm;

export function validateAddForm(form: AddFormState): AddFormValidationResult {
  const accountId = form.accountId.trim();
  if (!accountId) {
    return { valid: false, error: "Account is required." };
  }

  const bookingDate = form.bookingDate.trim();
  const merchant = form.merchant.trim();

  if (!bookingDate || !merchant) {
    return { valid: false, error: "Date and merchant are required." };
  }

  const amountNok = Number.parseFloat(form.amountNok.replace(",", "."));
  if (!Number.isFinite(amountNok)) {
    return { valid: false, error: "Amount must be a valid number." };
  }

  const note = form.note.trim();
  if (note.length > MAX_TRANSACTION_NOTE_LENGTH) {
    return { valid: false, error: MAX_TRANSACTION_NOTE_LENGTH_MESSAGE };
  }

  return { valid: true, accountId, bookingDate, amountNok, merchant, note };
}

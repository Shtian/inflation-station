export const MAX_TRANSACTION_NOTE_LENGTH = 500;

export const MAX_TRANSACTION_NOTE_LENGTH_MESSAGE =
  "Note must be 500 characters or fewer.";

export type NoteField = {
  value: string | null;
  length: number;
  error: string | null;
};

export function readNoteField(raw: string): NoteField {
  const trimmed = raw.trim();
  return {
    value: trimmed.length > 0 ? trimmed : null,
    length: trimmed.length,
    error:
      trimmed.length > MAX_TRANSACTION_NOTE_LENGTH
        ? MAX_TRANSACTION_NOTE_LENGTH_MESSAGE
        : null,
  };
}

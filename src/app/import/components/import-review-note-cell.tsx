import { Input } from "@/components/ui/input";
import { MAX_TRANSACTION_NOTE_LENGTH } from "@/lib/transactions/note";

type ImportReviewNoteCellProps = {
  rowId: string;
  rowNumber: number;
  value: string;
  errorMessage: string | null;
  onNoteChange: (rowId: string, note: string) => void;
};

export function ImportReviewNoteCell({
  rowId,
  rowNumber,
  value,
  errorMessage,
  onNoteChange,
}: ImportReviewNoteCellProps) {
  const isInvalid = errorMessage !== null;

  return (
    <div className="min-w-56 space-y-1">
      <Input
        value={value}
        onChange={(event) => onNoteChange(rowId, event.target.value)}
        aria-label={`Note for row ${rowNumber}`}
        placeholder="Optional note"
        aria-invalid={isInvalid}
        className="h-8 text-xs"
      />
      <p
        className={`text-[11px] ${isInvalid ? "text-red-700" : "text-muted-foreground"}`}
      >
        {isInvalid
          ? errorMessage
          : `${value.length}/${MAX_TRANSACTION_NOTE_LENGTH} characters`}
      </p>
    </div>
  );
}

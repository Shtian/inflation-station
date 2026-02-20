import { Input } from "@/components/ui/input";

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
      {isInvalid ? (
        <p className="text-[11px] text-red-700">{errorMessage}</p>
      ) : null}
    </div>
  );
}

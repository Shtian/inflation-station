import { Input } from "@/components/ui/input";

type ImportReviewNoteCellProps = {
  rowId: string;
  rowNumber: number;
  value: string;
  onNoteChange: (rowId: string, note: string) => void;
};

export function ImportReviewNoteCell({
  rowId,
  rowNumber,
  value,
  onNoteChange,
}: ImportReviewNoteCellProps) {
  return (
    <Input
      value={value}
      onChange={(event) => onNoteChange(rowId, event.target.value)}
      aria-label={`Note for row ${rowNumber}`}
      placeholder="Optional note"
      maxLength={500}
      className="h-8 min-w-56 text-xs"
    />
  );
}

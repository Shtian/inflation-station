"use client";

import { TriangleAlert } from "lucide-react";
import { type Dispatch, type SetStateAction, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImportReviewCategoryCell } from "./components/import-review-category-cell";
import { ImportReviewMessageCell } from "./components/import-review-message-cell";
import { ImportReviewNoteCell } from "./components/import-review-note-cell";
import { ImportReviewWarningsCell } from "./components/import-review-warnings-cell";

export const UNCATEGORIZED_SELECT_VALUE = "__uncategorized__";
export const MESSAGE_SOURCE_ORIGINAL = "original" as const;
export const MESSAGE_SOURCE_CLEANED = "cleaned" as const;

export type MessageSource =
  | typeof MESSAGE_SOURCE_ORIGINAL
  | typeof MESSAGE_SOURCE_CLEANED;

export type ReviewRow = {
  id: string;
  rowNumber: number;
  bookingDate: string;
  amountNok: number;
  currency: "NOK";
  normalizedMerchant: string;
  paymentType: string;
  name?: string;
  title?: string;
  cleanedMessage?: string | null;
  categoryId: string | null;
  potentialDuplicate: boolean;
};

type Category = {
  id: string;
  name: string;
  accountId: string | null;
};

const nokFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatNok(value: number) {
  return nokFormatter.format(value);
}

const SKELETON_ROWS = ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"] as const;
const TABLE_COLS = [
  "select",
  "date",
  "message",
  "amount",
  "type",
  "category",
  "note",
  "flags",
] as const;

export function ReviewTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {TABLE_COLS.map((col) => (
              <TableHead key={col}>
                <Skeleton className="h-4 w-full" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {SKELETON_ROWS.map((row) => (
            <TableRow key={row}>
              {TABLE_COLS.map((col) => (
                <TableCell key={col}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type ImportReviewTableProps = {
  rows: ReviewRow[];
  categories: Category[];
  categoryDecisions: Record<string, string>;
  noteDecisions: Record<string, string>;
  noteValidationErrors: Record<string, string>;
  messageDecisions: Record<string, MessageSource>;
  selectedRowIds: Set<string>;
  setCategoryDecisions: Dispatch<SetStateAction<Record<string, string>>>;
  setNoteDecision: (rowId: string, note: string) => void;
  setMessageDecisions: Dispatch<SetStateAction<Record<string, MessageSource>>>;
  toggleRowSelection: (rowId: string) => void;
  toggleAllRows: (rowIds: string[]) => void;
};

export function ImportReviewTable({
  rows,
  categories,
  categoryDecisions,
  noteDecisions,
  noteValidationErrors,
  messageDecisions,
  selectedRowIds,
  setCategoryDecisions,
  setNoteDecision,
  setMessageDecisions,
  toggleRowSelection,
  toggleAllRows,
}: ImportReviewTableProps) {
  const allRowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const selectedCount = allRowIds.filter((id) => selectedRowIds.has(id)).length;
  const headerChecked: boolean | "indeterminate" =
    selectedCount === rows.length && rows.length > 0
      ? true
      : selectedCount > 0
        ? "indeterminate"
        : false;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox
                checked={headerChecked}
                onCheckedChange={() => toggleAllRows(allRowIds)}
                aria-label="Select all rows"
              />
            </TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Payment type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>
              <span className="sr-only">Warnings</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TriangleAlert
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Potential duplicates or other import warnings
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const hasCleanedMessage =
              typeof row.cleanedMessage === "string" &&
              row.cleanedMessage.trim().length > 0;
            const selectedMessageSource =
              messageDecisions[row.id] ??
              (hasCleanedMessage
                ? MESSAGE_SOURCE_CLEANED
                : MESSAGE_SOURCE_ORIGINAL);
            const selectedCategoryId =
              categoryDecisions[row.id] ?? row.categoryId ?? "";
            return (
              <TableRow
                key={row.id}
                className={
                  !selectedRowIds.has(row.id) ? "opacity-40" : undefined
                }
              >
                <TableCell>
                  <Checkbox
                    checked={selectedRowIds.has(row.id)}
                    onCheckedChange={() => toggleRowSelection(row.id)}
                    aria-label={`Select row ${row.rowNumber}`}
                  />
                </TableCell>
                <TableCell>{row.bookingDate}</TableCell>
                <TableCell>
                  <ImportReviewMessageCell
                    rowId={row.id}
                    rowNumber={row.rowNumber}
                    title={row.title}
                    name={row.name}
                    cleanedMessage={row.cleanedMessage}
                    selectedMessageSource={selectedMessageSource}
                    onToggleMessageSource={(rowId) =>
                      setMessageDecisions((current) => ({
                        ...current,
                        [rowId]:
                          selectedMessageSource === MESSAGE_SOURCE_CLEANED
                            ? MESSAGE_SOURCE_ORIGINAL
                            : MESSAGE_SOURCE_CLEANED,
                      }))
                    }
                  />
                </TableCell>
                <TableCell>{formatNok(row.amountNok)}</TableCell>
                <TableCell>{row.paymentType}</TableCell>
                <TableCell>
                  <ImportReviewCategoryCell
                    rowId={row.id}
                    rowNumber={row.rowNumber}
                    selectedCategoryId={selectedCategoryId}
                    categories={categories}
                    onCategoryChange={(rowId, categoryId) =>
                      setCategoryDecisions((current) => ({
                        ...current,
                        [rowId]: categoryId,
                      }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <ImportReviewNoteCell
                    rowId={row.id}
                    rowNumber={row.rowNumber}
                    value={noteDecisions[row.id] ?? ""}
                    errorMessage={noteValidationErrors[row.id] ?? null}
                    onNoteChange={setNoteDecision}
                  />
                </TableCell>
                <TableCell>
                  <ImportReviewWarningsCell
                    potentialDuplicate={row.potentialDuplicate}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

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
import { formatNok } from "@/lib/format-nok";
import { classifyJevConfidence } from "@/lib/jev/confidence-tier";
import { ImportReviewCategoryCell } from "./components/import-review-category-cell";
import { ImportReviewMessageCell } from "./components/import-review-message-cell";
import { ImportReviewNoteCell } from "./components/import-review-note-cell";
import { ImportReviewWarningsCell } from "./components/import-review-warnings-cell";
import {
  MESSAGE_SOURCE_CLEANED,
  MESSAGE_SOURCE_ORIGINAL,
  type MessageSource,
  type ResolvedRowMessage,
} from "./message-cleanup/resolve-row-message";

export const UNCATEGORIZED_SELECT_VALUE = "__uncategorized__";

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
  categoryId: string | null;
  potentialDuplicate: boolean;
  suggestionSource: "RULE" | "OPENAI" | "JEV" | null;
  suggestionConfidence: number | null;
};

type Category = {
  id: string;
  name: string;
};

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
  resolvedMessages: Record<string, ResolvedRowMessage>;
  selectedRowIds: Set<string>;
  setCategoryDecisions: Dispatch<SetStateAction<Record<string, string>>>;
  setNoteDecision: (rowId: string, note: string) => void;
  selectMessageSource: (rowId: string, source: MessageSource) => void;
  toggleRowSelection: (rowId: string) => void;
  toggleAllRows: (rowIds: string[]) => void;
};

export function ImportReviewTable({
  rows,
  categories,
  categoryDecisions,
  noteDecisions,
  noteValidationErrors,
  resolvedMessages,
  selectedRowIds,
  setCategoryDecisions,
  setNoteDecision,
  selectMessageSource,
  toggleRowSelection,
  toggleAllRows,
}: ImportReviewTableProps) {
  const allRowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const selectedCount = allRowIds.filter((id) => selectedRowIds.has(id)).length;
  const headerChecked = selectedCount === rows.length && rows.length > 0;
  const headerIndeterminate = selectedCount > 0 && !headerChecked;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox
                checked={headerChecked}
                indeterminate={headerIndeterminate}
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
                  <TooltipTrigger
                    render={
                      <TriangleAlert
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    }
                  />
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
            const resolvedMessage: ResolvedRowMessage = resolvedMessages[
              row.id
            ] ?? {
              source: MESSAGE_SOURCE_ORIGINAL,
              display: row.title ?? row.name ?? "",
              originalMessage: row.title ?? row.name ?? "",
              hasCleanedAlternative: false,
              cleanedText: null,
              isPending: false,
            };
            const selectedCategoryId =
              categoryDecisions[row.id] ?? row.categoryId ?? "";
            const suggestionStillSelected =
              selectedCategoryId === (row.categoryId ?? "");
            const certaintyTier =
              row.suggestionSource === "JEV" &&
              suggestionStillSelected &&
              row.suggestionConfidence != null
                ? classifyJevConfidence(row.suggestionConfidence)
                : null;
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
                    resolvedMessage={resolvedMessage}
                    onToggleMessageSource={(rowId) =>
                      selectMessageSource(
                        rowId,
                        resolvedMessage.source === MESSAGE_SOURCE_ORIGINAL
                          ? MESSAGE_SOURCE_CLEANED
                          : MESSAGE_SOURCE_ORIGINAL,
                      )
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
                    certaintyTier={certaintyTier}
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

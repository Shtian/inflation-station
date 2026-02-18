"use client";

import { Sparkles, TriangleAlert } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

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

function formatNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const SKELETON_ROWS = ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"] as const;
const TABLE_COLS = [
  "date",
  "message",
  "amount",
  "type",
  "category",
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
  messageDecisions: Record<string, MessageSource>;
  setCategoryDecisions: Dispatch<SetStateAction<Record<string, string>>>;
  setMessageDecisions: Dispatch<SetStateAction<Record<string, MessageSource>>>;
};

export function ImportReviewTable({
  rows,
  categories,
  categoryDecisions,
  messageDecisions,
  setCategoryDecisions,
  setMessageDecisions,
}: ImportReviewTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Payment type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TriangleAlert
                      className="h-4 w-4 text-muted-foreground"
                      aria-label="Warnings"
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
            const originalMessage =
              typeof row.title === "string" && row.title.trim().length > 0
                ? row.title
                : typeof row.name === "string" && row.name.trim().length > 0
                  ? row.name
                  : "No original message";
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
            const isUncategorized = selectedCategoryId.length === 0;
            return (
              <TableRow key={row.id}>
                <TableCell>{row.bookingDate}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {selectedMessageSource === MESSAGE_SOURCE_CLEANED
                        ? row.cleanedMessage
                        : originalMessage}
                    </span>
                    {hasCleanedMessage ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Toggle message source for row ${row.rowNumber}`}
                              onClick={() =>
                                setMessageDecisions((current) => ({
                                  ...current,
                                  [row.id]:
                                    selectedMessageSource ===
                                    MESSAGE_SOURCE_CLEANED
                                      ? MESSAGE_SOURCE_ORIGINAL
                                      : MESSAGE_SOURCE_CLEANED,
                                }))
                              }
                              className={cn(
                                "shrink-0 rounded p-0.5 transition-colors hover:bg-accent",
                                selectedMessageSource === MESSAGE_SOURCE_CLEANED
                                  ? "text-violet-500"
                                  : "text-muted-foreground",
                              )}
                            >
                              <Sparkles
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-xs space-y-1 p-3 text-xs"
                          >
                            <p>
                              <span className="font-medium">Original:</span>{" "}
                              {originalMessage}
                            </p>
                            <p>
                              <span className="font-medium">AI-cleaned:</span>{" "}
                              {row.cleanedMessage}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{formatNok(row.amountNok)}</TableCell>
                <TableCell>{row.paymentType}</TableCell>
                <TableCell>
                  <Select
                    value={selectedCategoryId || UNCATEGORIZED_SELECT_VALUE}
                    onValueChange={(value) =>
                      setCategoryDecisions((current) => ({
                        ...current,
                        [row.id]:
                          value === UNCATEGORIZED_SELECT_VALUE ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger
                      aria-label={`Category for row ${row.rowNumber}`}
                      className={cn(
                        "w-[220px]",
                        isUncategorized && "text-amber-500",
                      )}
                    >
                      <SelectValue placeholder="Uncategorized" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value={UNCATEGORIZED_SELECT_VALUE}
                        className="text-amber-500"
                      >
                        Uncategorized
                      </SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {row.potentialDuplicate ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <TriangleAlert
                            className="h-4 w-4 text-amber-500"
                            aria-label="Potential duplicate"
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Potential duplicate
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Ellipsis,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  PAGE_SIZE_OPTIONS,
  type TransactionRow,
  type TransactionsResponse,
} from "../transactions-manager.types";

type TransactionsTableSectionProps = {
  loading: boolean;
  transactions: TransactionsResponse | null;
  onEdit: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  onGoToPage: (page: number) => void;
};

function formatNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function TransactionsTableSection({
  loading,
  transactions,
  onEdit,
  onDelete,
  pageSize,
  onPageSizeChange,
  onGoToPage,
}: TransactionsTableSectionProps) {
  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading transactions...</p>
    );
  }

  if (!transactions) {
    return null;
  }

  return (
    <section className="space-y-2" aria-live="polite">
      <p className="text-sm text-muted-foreground">
        {transactions.pagination.total} total transactions.
      </p>

      {transactions.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No transactions found for the selected filters.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Note</span>
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Payment type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-0 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.bookingDate}</TableCell>
                  <TableCell>{row.normalizedMerchant || "Unknown"}</TableCell>
                  <TableCell className="w-0">
                    {row.note ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="h-6 w-6"
                              aria-label={`View memo for transaction from ${row.bookingDate}`}
                            >
                              <FileText
                                className="size-4 shrink-0"
                                aria-hidden="true"
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-xs whitespace-pre-wrap wrap-break-word"
                          >
                            {row.note}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <CategoryBadge
                      label={row.categoryName ?? "Uncategorized"}
                    />
                  </TableCell>
                  <TableCell>{row.paymentType}</TableCell>
                  <TableCell className="text-right">
                    {formatNok(row.amountNok)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Actions for transaction from ${row.bookingDate}`}
                          title={`Actions for transaction from ${row.bookingDate}`}
                        >
                          <Ellipsis className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onSelect={() => onEdit(row)}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onDelete(row)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex w-full justify-center sm:justify-end">
            <div className="flex flex-col items-center gap-2 text-sm text-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Rows per page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) =>
                    onPageSizeChange(Number.parseInt(value, 10))
                  }
                >
                  <SelectTrigger
                    id="transactions-rows-per-page"
                    className="h-8 w-21"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span>
                Page {transactions.pagination.page} of{" "}
                {Math.max(1, transactions.pagination.totalPages)}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Go to first page"
                  onClick={() => onGoToPage(1)}
                  disabled={loading || transactions.pagination.page <= 1}
                >
                  <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Go to previous page"
                  onClick={() => onGoToPage(transactions.pagination.page - 1)}
                  disabled={loading || transactions.pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Go to next page"
                  onClick={() => onGoToPage(transactions.pagination.page + 1)}
                  disabled={
                    loading ||
                    transactions.pagination.page >=
                      Math.max(1, transactions.pagination.totalPages)
                  }
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Go to last page"
                  onClick={() =>
                    onGoToPage(Math.max(1, transactions.pagination.totalPages))
                  }
                  disabled={
                    loading ||
                    transactions.pagination.page >=
                      Math.max(1, transactions.pagination.totalPages)
                  }
                >
                  <ChevronsRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

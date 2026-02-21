import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type Account,
  ALL_ACCOUNTS_VALUE,
  ALL_CATEGORIES_VALUE,
  type Category,
  PAGE_SIZE_OPTIONS,
  type TransactionRow,
  type TransactionsResponse,
} from "../transactions-manager.types";

type TransactionsTableSectionProps = {
  loading: boolean;
  transactions: TransactionsResponse | null;
  accounts: Account[];
  categories: Category[];
  accountId: string;
  categoryId: string;
  globalQuery: string;
  dateFrom: string;
  dateTo: string;
  onEdit: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
  onAccountFilterChange: (accountId: string) => void;
  onCategoryFilterChange: (categoryId: string) => void;
  onGlobalQueryChange: (globalQuery: string) => void;
  onDateFromChange: (dateFrom: string) => void;
  onDateToChange: (dateTo: string) => void;
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

function getHeaderClassName(columnId: string) {
  if (columnId === "noteIndicator") {
    return "w-0";
  }

  if (columnId === "amountNok") {
    return "text-right";
  }

  if (columnId === "actions") {
    return "w-0 text-right";
  }

  return undefined;
}

function getCellClassName(columnId: string) {
  if (columnId === "noteIndicator") {
    return "w-0";
  }

  if (columnId === "amountNok" || columnId === "actions") {
    return "text-right";
  }

  return undefined;
}

export function TransactionsTableSection({
  loading,
  transactions,
  accounts,
  categories,
  accountId,
  categoryId,
  globalQuery,
  dateFrom,
  dateTo,
  onEdit,
  onDelete,
  onAccountFilterChange,
  onCategoryFilterChange,
  onGlobalQueryChange,
  onDateFromChange,
  onDateToChange,
  pageSize,
  onPageSizeChange,
  onGoToPage,
}: TransactionsTableSectionProps) {
  const columnHelper = createColumnHelper<TransactionRow>();
  const rows = transactions?.rows ?? [];
  const table = useReactTable({
    data: rows,
    columns: [
      columnHelper.accessor("bookingDate", {
        header: "Date",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("normalizedMerchant", {
        header: "Merchant",
        cell: (info) => info.getValue() || "Unknown",
      }),
      columnHelper.display({
        id: "noteIndicator",
        header: () => <span className="sr-only">Note</span>,
        cell: (info) => {
          const note = info.row.original.note;
          const bookingDate = info.row.original.bookingDate;

          if (!note) {
            return null;
          }

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6"
                    aria-label={`View memo for transaction from ${bookingDate}`}
                  >
                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="wrap-break-word max-w-xs whitespace-pre-wrap"
                >
                  {note}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      }),
      columnHelper.display({
        id: "category",
        header: "Category",
        cell: (info) => (
          <CategoryBadge
            label={info.row.original.categoryName ?? "Uncategorized"}
          />
        ),
      }),
      columnHelper.accessor("paymentType", {
        header: "Payment type",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("amountNok", {
        header: "Amount",
        cell: (info) => formatNok(info.getValue()),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: (info) => {
          const row = info.row.original;

          return (
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
          );
        },
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading transactions...</p>
    );
  }

  if (!transactions) {
    return null;
  }

  const hasActiveFilters =
    accountId.length > 0 ||
    categoryId.length > 0 ||
    globalQuery.length > 0 ||
    dateFrom.length > 0 ||
    dateTo.length > 0;

  return (
    <section className="space-y-2" aria-live="polite">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="transactions-global-query">Search</Label>
          <Input
            id="transactions-global-query"
            type="search"
            value={globalQuery}
            onChange={(event) => onGlobalQueryChange(event.target.value)}
            placeholder="Search merchant or note"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transactions-date-from">Date from</Label>
          <Input
            id="transactions-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transactions-date-to">Date to</Label>
          <Input
            id="transactions-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transactions-account-filter">Account</Label>
          <Select
            value={accountId || ALL_ACCOUNTS_VALUE}
            onValueChange={(value) =>
              onAccountFilterChange(value === ALL_ACCOUNTS_VALUE ? "" : value)
            }
          >
            <SelectTrigger id="transactions-account-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACCOUNTS_VALUE}>All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="transactions-category-filter">Category</Label>
          <Select
            value={categoryId || ALL_CATEGORIES_VALUE}
            onValueChange={(value) =>
              onCategoryFilterChange(
                value === ALL_CATEGORIES_VALUE ? "" : value,
              )
            }
          >
            <SelectTrigger id="transactions-category-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES_VALUE}>
                All categories
              </SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        {transactions.pagination.total} total transactions.
      </p>

      {transactions.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {hasActiveFilters
            ? "No transactions found for the selected filters."
            : "No transactions found."}
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={getHeaderClassName(header.column.id)}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={getCellClassName(cell.column.id)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex w-full justify-center sm:justify-end">
            <div className="flex flex-col items-center gap-2 text-foreground text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
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

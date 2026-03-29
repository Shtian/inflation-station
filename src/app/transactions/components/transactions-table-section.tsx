import {
  createColumnHelper,
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  type PaginationState,
  type RowSelectionState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Ellipsis,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { CategoryCombobox } from "@/components/category-combobox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { formatNok } from "@/lib/format-nok";
import { cn } from "@/lib/utils";
import {
  type Account,
  ALL_ACCOUNTS_VALUE,
  type Category,
  PAGE_SIZE_OPTIONS,
  type TransactionRow,
  type TransactionSorting,
  type TransactionsResponse,
} from "../transactions-manager.types";

const COLUMN_VISIBILITY_STORAGE_KEY =
  "transactions-table-section-column-visibility";
const HIDEABLE_COLUMN_IDS = [
  "bookingDate",
  "merchant",
  "category",
  "paymentType",
  "amountNok",
] as const;
const COLUMN_LABELS: Record<string, string> = {
  bookingDate: "Date",
  merchant: "Merchant",
  paymentType: "Payment type",
  amountNok: "Amount",
  category: "Category",
};
const columnHelper = createColumnHelper<TransactionRow>();

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
  sorting?: TransactionSorting;
  onAdd: () => void;
  onEdit: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
  onBulkDelete: (ids: string[]) => void;
  onAccountFilterChange: (accountId: string) => void;
  onCategoryFilterChange: (categoryId: string) => void;
  onGlobalQueryChange: (globalQuery: string) => void;
  onDateFromChange: (dateFrom: string) => void;
  onDateToChange: (dateTo: string) => void;
  onSortingChange: (sorting: TransactionSorting | undefined) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  onGoToPage: (page: number) => void;
};

function getHeaderClassName(columnId: string) {
  if (columnId === "select" || columnId === "noteIndicator") {
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
  if (columnId === "select" || columnId === "noteIndicator") {
    return "w-12";
  }

  if (columnId === "amountNok") {
    return "text-right tabular-nums font-mono";
  }

  return undefined;
}

function getNextSorting(
  current: TransactionSorting | undefined,
  field: TransactionSorting["field"],
): TransactionSorting | undefined {
  if (!current || current.field !== field) {
    return {
      field,
      direction: "asc",
    };
  }

  if (current.direction === "asc") {
    return {
      field,
      direction: "desc",
    };
  }

  return undefined;
}

function getSortingIcon(sorting: TransactionSorting | undefined) {
  if (!sorting) {
    return <ArrowUpDown className="h-4 w-4" aria-hidden="true" />;
  }

  return sorting.direction === "asc" ? (
    <ArrowUp className="h-4 w-4" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-4 w-4" aria-hidden="true" />
  );
}

function parseStoredColumnVisibility(
  storedValue: string,
): VisibilityState | null {
  const parsed = JSON.parse(storedValue);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const nextState: VisibilityState = {};
  for (const columnId of HIDEABLE_COLUMN_IDS) {
    const value = (parsed as Record<string, unknown>)[columnId];
    if (typeof value === "boolean") {
      nextState[columnId] = value;
    }
  }

  return nextState;
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
  sorting,
  onAdd,
  onEdit,
  onDelete,
  onBulkDelete,
  onAccountFilterChange,
  onCategoryFilterChange,
  onGlobalQueryChange,
  onDateFromChange,
  onDateToChange,
  onSortingChange,
  pageSize,
  onPageSizeChange,
  onGoToPage,
}: TransactionsTableSectionProps) {
  const rows = transactions?.rows ?? [];
  const currentPage = transactions?.pagination.page ?? 1;
  const totalPages = Math.max(1, transactions?.pagination.totalPages ?? 1);
  const paginationState: PaginationState = {
    pageIndex: currentPage - 1,
    pageSize,
  };
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    paymentType: false,
  });
  const [hasHydratedColumnVisibility, setHasHydratedColumnVisibility] =
    useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Reset selection on filter/page/sort changes
  const resetKeyRef = useRef(
    [accountId, categoryId, globalQuery, dateFrom, dateTo, sorting, currentPage]
      .map(String)
      .join("|"),
  );
  useEffect(() => {
    const nextKey = [
      accountId,
      categoryId,
      globalQuery,
      dateFrom,
      dateTo,
      sorting ? `${sorting.field}:${sorting.direction}` : "",
      currentPage,
    ].join("|");

    if (nextKey !== resetKeyRef.current) {
      resetKeyRef.current = nextKey;
      setRowSelection({});
    }
  }, [
    accountId,
    categoryId,
    globalQuery,
    dateFrom,
    dateTo,
    sorting,
    currentPage,
  ]);

  useEffect(() => {
    const storedValue = sessionStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (!storedValue) {
      setHasHydratedColumnVisibility(true);
      return;
    }

    try {
      const parsed = parseStoredColumnVisibility(storedValue);
      if (parsed) {
        setColumnVisibility(parsed);
      }
    } catch {
      sessionStorage.removeItem(COLUMN_VISIBILITY_STORAGE_KEY);
    } finally {
      setHasHydratedColumnVisibility(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedColumnVisibility) {
      return;
    }

    sessionStorage.setItem(
      COLUMN_VISIBILITY_STORAGE_KEY,
      JSON.stringify(columnVisibility),
    );
  }, [columnVisibility, hasHydratedColumnVisibility]);

  const sortableHeader = useCallback(
    (label: string, field: TransactionSorting["field"]) => {
      const isSorted = sorting?.field === field ? sorting : undefined;

      return (
        <Button
          type="button"
          variant="ghost"
          className="-ml-3 h-8 gap-1"
          onClick={() => onSortingChange(getNextSorting(sorting, field))}
        >
          <span>{label}</span>
          {getSortingIcon(isSorted)}
        </Button>
      );
    },
    [sorting, onSortingChange],
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(checked) =>
              table.toggleAllPageRowsSelected(Boolean(checked))
            }
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
            aria-label={`Select transaction from ${row.original.bookingDate}`}
          />
        ),
      }),
      columnHelper.accessor("bookingDate", {
        enableHiding: true,
        header: () => sortableHeader("Date", "bookingDate"),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("merchant", {
        enableHiding: true,
        header: () => sortableHeader("Merchant", "merchant"),
        cell: (info) =>
          info.getValue() ?? info.row.original.normalizedMerchant ?? "Unknown",
      }),
      columnHelper.display({
        id: "noteIndicator",
        enableHiding: false,
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
        enableHiding: true,
        header: () => sortableHeader("Category", "category"),
        cell: (info) => (
          <CategoryBadge
            label={info.row.original.categoryName ?? "Uncategorized"}
          />
        ),
      }),
      columnHelper.accessor("paymentType", {
        enableHiding: true,
        header: "Payment type",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("amountNok", {
        enableHiding: true,
        header: () => sortableHeader("Amount", "amountNok"),
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={cn(value > 0 && "text-success")}>
              {formatNok(info.getValue())}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: (info) => {
          const row = info.row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="invisible cursor-pointer group-hover/row:visible"
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
    [sortableHeader, onEdit, onDelete],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      columnVisibility,
      pagination: paginationState,
      rowSelection,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    pageCount: totalPages,
    onPaginationChange: (updater) => {
      const nextState = functionalUpdate(updater, paginationState);

      if (nextState.pageSize !== paginationState.pageSize) {
        onPageSizeChange(nextState.pageSize);
        return;
      }

      if (nextState.pageIndex !== paginationState.pageIndex) {
        onGoToPage(nextState.pageIndex + 1);
      }
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const visibleColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && column.id !== "actions");

  if (loading && !transactions) {
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
      {/* Filters and Actions Card */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-50 flex-1">
            <label
              htmlFor="transactions-global-query"
              className="mb-1.5 block font-medium text-muted-foreground text-xs"
            >
              Search
            </label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="transactions-global-query"
                type="search"
                value={globalQuery}
                onChange={(event) => onGlobalQueryChange(event.target.value)}
                placeholder="Search merchant or notes..."
                className="h-9 bg-background pl-9"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div>
              <label
                htmlFor="transactions-date-from"
                className="mb-1.5 block font-medium text-muted-foreground text-xs"
              >
                Date from
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="transactions-date-from"
                    variant="outline"
                    className={cn(
                      "h-9 w-35 justify-start bg-background text-left font-normal",
                      !dateFrom && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom
                      ? format(parseISO(dateFrom), "dd/MM/yyyy")
                      : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom ? parseISO(dateFrom) : undefined}
                    onSelect={(date) =>
                      onDateFromChange(date ? format(date, "yyyy-MM-dd") : "")
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label
                htmlFor="transactions-date-to"
                className="mb-1.5 block font-medium text-muted-foreground text-xs"
              >
                Date to
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="transactions-date-to"
                    variant="outline"
                    className={cn(
                      "h-9 w-35 justify-start bg-background text-left font-normal",
                      !dateTo && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo
                      ? format(parseISO(dateTo), "dd/MM/yyyy")
                      : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo ? parseISO(dateTo) : undefined}
                    onSelect={(date) =>
                      onDateToChange(date ? format(date, "yyyy-MM-dd") : "")
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <label
              htmlFor="transactions-account-filter"
              className="mb-1.5 block font-medium text-muted-foreground text-xs"
            >
              Account
            </label>
            <Select
              value={accountId || ALL_ACCOUNTS_VALUE}
              onValueChange={(value) =>
                onAccountFilterChange(value === ALL_ACCOUNTS_VALUE ? "" : value)
              }
            >
              <SelectTrigger
                id="transactions-account-filter"
                className="h-9 w-40 bg-background"
              >
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

          <div>
            <label
              htmlFor="transactions-category-filter"
              className="mb-1.5 block font-medium text-muted-foreground text-xs"
            >
              Category
            </label>
            <CategoryCombobox
              id="transactions-category-filter"
              value={categoryId}
              categories={categories}
              onValueChange={(value) => onCategoryFilterChange(value)}
              placeholder="All categories"
              emptyLabel="No matching categories."
              showClear
            />
          </div>
        </div>
      </div>

      {/* Table Info & Actions */}
      <div className="mt-8 flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          {Object.keys(rowSelection).length > 0 ? (
            <>
              <span className="font-medium text-foreground">
                {Object.keys(rowSelection).length}
              </span>{" "}
              of {transactions.pagination.total} selected
            </>
          ) : (
            <>
              {transactions.pagination.total} total transactions.
              {loading ? " Updating..." : null}
            </>
          )}
        </span>

        <div className="flex items-center gap-2">
          {Object.keys(rowSelection).length > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => onBulkDelete(Object.keys(rowSelection))}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
              <div className="mx-1 h-4 w-px bg-border" />
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {visibleColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) =>
                    column.toggleVisibility(Boolean(checked))
                  }
                >
                  {COLUMN_LABELS[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button type="button" size="sm" className="gap-2" onClick={onAdd}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add transaction
          </Button>
        </div>
      </div>

      {/* Transactions Table */}
      {transactions.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {hasActiveFilters
            ? "No transactions found for the selected filters."
            : "No transactions found."}
        </p>
      ) : (
        <div className="mt-4 rounded-xl border border-border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow className="bg-muted/30" key={headerGroup.id}>
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
            <TableBody className="[&_tr:last-child]:border-b">
              {table.getRowModel().rows.map((row) => (
                <TableRow className="group/row" key={row.id}>
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

          <div className="flex w-full justify-center p-2 sm:justify-end">
            <div className="flex items-center justify-between gap-4">
              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="select-rows-per-page">
                  Rows per page
                </FieldLabel>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) =>
                    onPageSizeChange(Number.parseInt(value, 10))
                  }
                >
                  <SelectTrigger id="transactions-rows-per-page">
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
              </Field>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="Go to previous page"
                      className="cursor-pointer"
                      onClick={() => table.previousPage()}
                      disabled={loading || !table.getCanPreviousPage()}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      Previous
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="Go to next page"
                      className="cursor-pointer"
                      onClick={() => table.nextPage()}
                      disabled={loading || !table.getCanNextPage()}
                    >
                      Next{" "}
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

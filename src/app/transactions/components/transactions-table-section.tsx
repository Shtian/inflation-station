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
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Ellipsis,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { Button } from "@/components/ui/button";
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
import { formatNok } from "@/lib/format-nok";
import {
  type Account,
  ALL_ACCOUNTS_VALUE,
  ALL_CATEGORIES_VALUE,
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
    return "w-0";
  }

  if (columnId === "amountNok" || columnId === "actions") {
    return "text-right";
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
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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
        cell: (info) => formatNok(info.getValue()),
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

  const selectedIds = Object.keys(rowSelection);
  const selectedCount = selectedIds.length;

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

      {selectedCount > 0 ? (
        <div className="flex items-center gap-3">
          <span className="text-sm">
            {selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onBulkDelete(selectedIds)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete selected
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRowSelection({})}
          >
            Clear selection
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="gap-2">
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
        </div>
      )}

      <p className="text-muted-foreground text-sm">
        {transactions.pagination.total} total transactions.
      </p>

      {loading ? (
        <p className="text-muted-foreground text-sm">Updating results...</p>
      ) : null}

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
                Page {table.getState().pagination.pageIndex + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Go to first page"
                  onClick={() => table.setPageIndex(0)}
                  disabled={loading || !table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Go to previous page"
                  onClick={() => table.previousPage()}
                  disabled={loading || !table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Go to next page"
                  onClick={() => table.nextPage()}
                  disabled={loading || !table.getCanNextPage()}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Go to last page"
                  onClick={() => table.setPageIndex(totalPages - 1)}
                  disabled={loading || !table.getCanNextPage()}
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

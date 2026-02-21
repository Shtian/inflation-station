import {
  PAGE_SIZE_OPTIONS,
  TRANSACTIONS_SORT_FIELDS,
  type TransactionSorting,
} from "./transactions-manager.types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;

const TABLE_QUERY_PARAMS = [
  "page",
  "pageSize",
  "sorting",
  "globalQuery",
  "query",
  "dateFrom",
  "dateTo",
  "accountId",
  "categoryId",
] as const;

const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type TransactionsTableUrlState = {
  page: number;
  pageSize: number;
  sorting?: TransactionSorting;
  globalQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
  categoryId?: string;
};

function parsePositiveInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}

function parseOptionalFilterParam(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseSortingParam(
  value: string | null,
): TransactionSorting | undefined {
  if (value === null) {
    return undefined;
  }

  const match = /^([a-zA-Z]+):(asc|desc)$/.exec(value);
  if (!match) {
    return undefined;
  }

  const field = match[1];
  if (
    !TRANSACTIONS_SORT_FIELDS.includes(field as TransactionSorting["field"])
  ) {
    return undefined;
  }

  return {
    field: field as TransactionSorting["field"],
    direction: match[2] as TransactionSorting["direction"],
  };
}

function parseDateInputValue(value: string | null): string | undefined {
  return value && DATE_INPUT_REGEX.test(value) ? value : undefined;
}

function parsePageSize(value: string | null): number {
  const parsed = parsePositiveInteger(value);
  if (!parsed) {
    return DEFAULT_PAGE_SIZE;
  }

  return PAGE_SIZE_OPTIONS.includes(
    String(parsed) as (typeof PAGE_SIZE_OPTIONS)[number],
  )
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function applyTableStateToSearchParams(
  searchParams: URLSearchParams,
  state: TransactionsTableUrlState,
) {
  for (const key of TABLE_QUERY_PARAMS) {
    searchParams.delete(key);
  }

  searchParams.set("page", String(state.page));
  searchParams.set("pageSize", String(state.pageSize));

  if (state.sorting) {
    searchParams.set(
      "sorting",
      `${state.sorting.field}:${state.sorting.direction}`,
    );
  }
  if (state.globalQuery) {
    searchParams.set("globalQuery", state.globalQuery);
  }
  if (state.dateFrom) {
    searchParams.set("dateFrom", state.dateFrom);
  }
  if (state.dateTo) {
    searchParams.set("dateTo", state.dateTo);
  }
  if (state.accountId) {
    searchParams.set("accountId", state.accountId);
  }
  if (state.categoryId) {
    searchParams.set("categoryId", state.categoryId);
  }
}

export function parseTransactionsTableUrlState(
  searchParams: URLSearchParams,
): TransactionsTableUrlState {
  const page = parsePositiveInteger(searchParams.get("page")) ?? DEFAULT_PAGE;
  const pageSize = parsePageSize(searchParams.get("pageSize"));

  return {
    page,
    pageSize,
    sorting: parseSortingParam(searchParams.get("sorting")),
    globalQuery:
      parseOptionalFilterParam(searchParams.get("globalQuery")) ??
      parseOptionalFilterParam(searchParams.get("query")),
    dateFrom: parseDateInputValue(searchParams.get("dateFrom")),
    dateTo: parseDateInputValue(searchParams.get("dateTo")),
    accountId: parseOptionalFilterParam(searchParams.get("accountId")),
    categoryId: parseOptionalFilterParam(searchParams.get("categoryId")),
  };
}

export function toTransactionsTableSearchParams(
  state: TransactionsTableUrlState,
  sourceSearchParams?: URLSearchParams,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(sourceSearchParams?.toString());
  applyTableStateToSearchParams(nextSearchParams, state);
  return nextSearchParams;
}

export function areTransactionsTableUrlStatesEqual(
  left: TransactionsTableUrlState,
  right: TransactionsTableUrlState,
) {
  return (
    left.page === right.page &&
    left.pageSize === right.pageSize &&
    left.sorting?.field === right.sorting?.field &&
    left.sorting?.direction === right.sorting?.direction &&
    left.globalQuery === right.globalQuery &&
    left.dateFrom === right.dateFrom &&
    left.dateTo === right.dateTo &&
    left.accountId === right.accountId &&
    left.categoryId === right.categoryId
  );
}

export function withFilterStateChange(
  current: TransactionsTableUrlState,
  updates: Partial<Omit<TransactionsTableUrlState, "page">>,
): TransactionsTableUrlState {
  return {
    ...current,
    ...updates,
    page: 1,
  };
}

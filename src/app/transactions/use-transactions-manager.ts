"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Account,
  Category,
  TransactionSorting,
  TransactionsResponse,
} from "./transactions-manager.types";
import {
  areTransactionsTableUrlStatesEqual,
  parseTransactionsTableUrlState,
  toTransactionsTableSearchParams,
  withFilterStateChange,
} from "./transactions-table-url-state";

function getTransactionsErrorMessage(body: unknown) {
  if (typeof body === "object" && body && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return "Could not load transactions.";
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

export function useTransactionsManager() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsedUrlState = useMemo(
    () =>
      parseTransactionsTableUrlState(
        new URLSearchParams(searchParams.toString()),
      ),
    [searchParams],
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tableState, setTableState] = useState(parsedUrlState);
  const [globalQueryInput, setGlobalQueryInput] = useState(
    parsedUrlState.globalQuery ?? "",
  );
  const debouncedGlobalQueryInput = useDebouncedValue(globalQueryInput, 250);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionsResponse | null>(
    null,
  );

  useEffect(() => {
    setTableState((current) =>
      areTransactionsTableUrlStatesEqual(current, parsedUrlState)
        ? current
        : parsedUrlState,
    );
  }, [parsedUrlState]);

  useEffect(() => {
    setGlobalQueryInput(tableState.globalQuery ?? "");
  }, [tableState.globalQuery]);

  useEffect(() => {
    const trimmed = debouncedGlobalQueryInput.trim();
    const nextGlobalQuery = trimmed.length > 0 ? trimmed : undefined;

    setTableState((current) => {
      if (current.globalQuery === nextGlobalQuery) {
        return current;
      }

      return withFilterStateChange(current, {
        globalQuery: nextGlobalQuery,
      });
    });
  }, [debouncedGlobalQueryInput]);

  useEffect(() => {
    const nextParams = toTransactionsTableSearchParams(
      tableState,
      new URLSearchParams(searchParams.toString()),
    );
    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();

    if (nextQuery === currentQuery) {
      return;
    }

    router.replace(
      nextQuery.length > 0 ? `${pathname}?${nextQuery}` : pathname,
      {
        scroll: false,
      },
    );
  }, [pathname, router, searchParams, tableState]);

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/accounts");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("accounts" in body) ||
      !Array.isArray(body.accounts)
    ) {
      setAccounts([]);
      return;
    }

    setAccounts(
      (body.accounts as Array<{ id: string; name: string }>).map((next) => ({
        id: next.id,
        name: next.name,
      })),
    );
  }, []);

  const loadCategories = useCallback(async () => {
    const response = await fetch("/api/categories");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("categories" in body) ||
      !Array.isArray(body.categories)
    ) {
      setCategories([]);
      return;
    }

    setCategories(
      (
        body.categories as Array<{
          id: string;
          name: string;
          accountId: string | null;
        }>
      ).map((next) => ({
        id: next.id,
        name: next.name,
        accountId: next.accountId,
      })),
    );
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(tableState.page));
    params.set("pageSize", String(tableState.pageSize));
    if (tableState.accountId) {
      params.set("accountId", tableState.accountId);
    }
    if (tableState.categoryId) {
      params.set("categoryId", tableState.categoryId);
    }
    if (tableState.globalQuery) {
      params.set("globalQuery", tableState.globalQuery);
    }
    if (tableState.dateFrom) {
      params.set("dateFrom", tableState.dateFrom);
    }
    if (tableState.dateTo) {
      params.set("dateTo", tableState.dateTo);
    }
    if (tableState.sorting) {
      params.set(
        "sorting",
        `${tableState.sorting.field}:${tableState.sorting.direction}`,
      );
    }

    const response = await fetch(`/api/transactions?${params.toString()}`);
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("rows" in body) ||
      !("pagination" in body)
    ) {
      setTransactions(null);
      setError(getTransactionsErrorMessage(body));
      setLoading(false);
      return;
    }

    const parsed = body as TransactionsResponse;
    const totalPages = Math.max(1, parsed.pagination.totalPages || 1);
    const nextPage = Math.min(tableState.page, totalPages);

    if (nextPage !== tableState.page) {
      setTableState((current) => ({
        ...current,
        page: nextPage,
      }));
      setLoading(false);
      return;
    }

    setTransactions(parsed);
    setLoading(false);
  }, [tableState]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const goToPage = useCallback(
    (nextPage: number) => {
      const max = Math.max(1, transactions?.pagination.totalPages ?? 1);
      const clamped = Math.min(Math.max(1, nextPage), max);
      setTableState((current) => ({
        ...current,
        page: clamped,
      }));
    },
    [transactions?.pagination.totalPages],
  );

  const setAccountFilter = useCallback((nextAccountId: string) => {
    setTableState((current) =>
      withFilterStateChange(current, {
        accountId: nextAccountId || undefined,
      }),
    );
  }, []);

  const setPageSizeFilter = useCallback((nextPageSize: number) => {
    setTableState((current) =>
      withFilterStateChange(current, {
        pageSize: nextPageSize,
      }),
    );
  }, []);

  const setGlobalQueryFilter = useCallback((nextGlobalQuery: string) => {
    setGlobalQueryInput(nextGlobalQuery);
  }, []);

  const setDateFromFilter = useCallback((nextDateFrom: string) => {
    const trimmed = nextDateFrom.trim();
    setTableState((current) =>
      withFilterStateChange(current, {
        dateFrom: trimmed.length > 0 ? trimmed : undefined,
      }),
    );
  }, []);

  const setDateToFilter = useCallback((nextDateTo: string) => {
    const trimmed = nextDateTo.trim();
    setTableState((current) =>
      withFilterStateChange(current, {
        dateTo: trimmed.length > 0 ? trimmed : undefined,
      }),
    );
  }, []);

  const setCategoryFilter = useCallback((nextCategoryId: string) => {
    setTableState((current) =>
      withFilterStateChange(current, {
        categoryId: nextCategoryId || undefined,
      }),
    );
  }, []);

  const setSorting = useCallback(
    (nextSorting: TransactionSorting | undefined) => {
      setTableState((current) =>
        withFilterStateChange(current, {
          sorting: nextSorting,
        }),
      );
    },
    [],
  );

  return {
    accounts,
    categories,
    accountId: tableState.accountId ?? "",
    categoryId: tableState.categoryId ?? "",
    globalQuery: globalQueryInput,
    dateFrom: tableState.dateFrom ?? "",
    dateTo: tableState.dateTo ?? "",
    sorting: tableState.sorting,
    pageSize: tableState.pageSize,
    loading,
    error,
    transactions,
    loadTransactions,
    goToPage,
    setAccountFilter,
    setCategoryFilter,
    setGlobalQueryFilter,
    setDateFromFilter,
    setDateToFilter,
    setSorting,
    setPageSizeFilter,
  };
}

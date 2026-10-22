"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { createCategoryInline } from "@/lib/categories/create-category-inline";
import { inferCategoryKind } from "@/lib/categories/infer-category-kind";
import type {
  Account,
  Category,
  TransactionSorting,
  TransactionsResponse,
} from "./transactions-manager.types";
import {
  areTransactionsTableUrlStatesEqual,
  withFilterStateChange,
} from "./transactions-table-url-state";

function getTransactionsErrorMessage(body: unknown) {
  if (typeof body === "object" && body && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return "Kunne ikke laste inn transaksjoner.";
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
  const urlState = useSearch({ from: "/transactions/" });
  const navigate = useNavigate({ from: "/transactions/" });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tableState, setTableState] = useState(urlState);
  const [globalQueryInput, setGlobalQueryInput] = useState(
    urlState.globalQuery ?? "",
  );
  const debouncedGlobalQueryInput = useDebouncedValue(globalQueryInput, 250);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionsResponse | null>(
    null,
  );

  useEffect(() => {
    setTableState((current) =>
      areTransactionsTableUrlStatesEqual(current, urlState)
        ? current
        : urlState,
    );
  }, [urlState]);

  useEffect(() => {
    setGlobalQueryInput(urlState.globalQuery ?? "");
  }, [urlState.globalQuery]);

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
    if (areTransactionsTableUrlStatesEqual(tableState, urlState)) {
      return;
    }

    void navigate({ search: tableState, replace: true });
  }, [navigate, tableState, urlState]);

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

  const loadCategories = useCallback(async (): Promise<Category[]> => {
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
      return [];
    }

    const nextCategories = (
      body.categories as Array<{
        id: string;
        name: string;
        accountId: string | null;
      }>
    ).map((next) => ({
      id: next.id,
      name: next.name,
      accountId: next.accountId,
    }));
    setCategories(nextCategories);
    return nextCategories;
  }, []);

  const createCategory = useCallback(
    (name: string, amountNok: number | null) =>
      createCategoryInline({
        name,
        kind: inferCategoryKind(amountNok),
        onCreated: (category) =>
          setCategories((current) => [
            ...current,
            { ...category, accountId: null },
          ]),
        reloadCategories: loadCategories,
      }),
    [loadCategories],
  );

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
    createCategory,
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

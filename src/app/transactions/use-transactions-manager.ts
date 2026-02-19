"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Account,
  Category,
  TransactionsResponse,
} from "./transactions-manager.types";

function getTransactionsErrorMessage(body: unknown) {
  if (typeof body === "object" && body && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return "Could not load transactions.";
}

export function useTransactionsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionsResponse | null>(
    null,
  );

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
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (accountId) {
      params.set("accountId", accountId);
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
    const nextPage = Math.min(page, totalPages);

    if (nextPage !== page) {
      setPage(nextPage);
      setLoading(false);
      return;
    }

    setTransactions(parsed);
    setLoading(false);
  }, [accountId, page, pageSize]);

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
      setPage(clamped);
    },
    [transactions?.pagination.totalPages],
  );

  const setAccountFilter = useCallback((nextAccountId: string) => {
    setAccountId(nextAccountId);
    setPage(1);
  }, []);

  const setPageSizeFilter = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  }, []);

  return {
    accounts,
    categories,
    accountId,
    pageSize,
    loading,
    error,
    transactions,
    loadTransactions,
    goToPage,
    setAccountFilter,
    setPageSizeFilter,
  };
}

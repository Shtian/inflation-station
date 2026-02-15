"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";

type Account = {
  id: string;
  name: string;
  institution: string | null;
  isActive: boolean;
};

type ImportSummary = {
  imported: number;
  duplicates: number;
  ignoredReserved: number;
  invalid: number;
};

type ImportError = {
  rowNumber: number;
  code: string;
  message: string;
};

type ImportResponse = {
  summary: ImportSummary;
  errors: ImportError[];
};

type Category = {
  id: string;
  name: string;
  kind: string;
  accountId: string | null;
};

type ReviewItem = {
  transaction: {
    id: string;
    bookingDate: string;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: string;
  };
  suggestion: {
    id: string;
    source: string;
    confidence: number | null;
    reasoning: string | null;
    category: {
      id: string;
      name: string;
    };
  };
};

type DashboardRangePreset = "30d" | "90d" | "ytd" | "custom";

type DashboardAnalytics = {
  filters: {
    accountId: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  netCashflow: Array<{
    date: string;
    netNok: number;
  }>;
  inflowOutflow: Array<{
    date: string;
    inflowNok: number;
    outflowNok: number;
  }>;
  categoryBreakdown: Array<{
    categoryId: string | null;
    categoryName: string;
    spendNok: number;
    transactionCount: number;
  }>;
  accountTrend: Array<{
    accountId: string;
    accountName: string;
    points: Array<{
      date: string;
      netNok: number;
      cumulativeNok: number;
    }>;
  }>;
};

function getErrorMessage(status: number, body: unknown) {
  if (typeof body === "object" && body && "error" in body) {
    const code = String((body as { error: unknown }).error);
    if (status === 409 && code === "ACCOUNT_HAS_TRANSACTIONS") {
      return "Cannot delete account with imported transactions.";
    }

    if (status === 409 && code === "ACCOUNT_NAME_MUST_BE_UNIQUE") {
      return "An account with this name already exists.";
    }

    if (status === 404 && code === "ACCOUNT_NOT_FOUND") {
      return "Selected account was not found.";
    }
  }

  return "Request failed. Please try again.";
}

function getReviewErrorMessage(status: number, body: unknown) {
  if (typeof body === "object" && body && "error" in body) {
    const code = String((body as { error: unknown }).error);

    if (status === 400 && code === "CATEGORY_NOT_FOUND") {
      return "One or more selected categories no longer exist. Refresh and try again.";
    }

    if (status === 400 && code === "INVALID_REVIEW_SUBMIT_PAYLOAD") {
      return "Invalid review submission. Please verify selected categories.";
    }
  }

  return "Could not submit review decisions.";
}

function formatNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPresetRange(preset: Exclude<DashboardRangePreset, "custom">) {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date(endDate);

  if (preset === "30d") {
    startDate.setDate(startDate.getDate() - 29);
  } else if (preset === "90d") {
    startDate.setDate(startDate.getDate() - 89);
  } else {
    startDate.setMonth(0, 1);
  }

  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
  };
}

function buildInitialDecisions(items: ReviewItem[]) {
  return items.reduce<Record<string, string>>((acc, item) => {
    acc[item.transaction.id] = item.suggestion.category.id;
    return acc;
  }, {});
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountInstitution, setNewAccountInstitution] = useState("");

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editInstitution, setEditInstitution] = useState("");

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [decisionsByTransactionId, setDecisionsByTransactionId] = useState<
    Record<string, string>
  >({});
  const [dashboardAccountId, setDashboardAccountId] = useState("");
  const [dashboardRangePreset, setDashboardRangePreset] =
    useState<DashboardRangePreset>("30d");
  const [dashboardStartDate, setDashboardStartDate] = useState(
    () => getPresetRange("30d").startDate,
  );
  const [dashboardEndDate, setDashboardEndDate] = useState(
    () => getPresetRange("30d").endDate,
  );
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardAnalytics | null>(
    null,
  );

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountError(null);

    const response = await fetch("/api/accounts");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("accounts" in body)
    ) {
      setAccountError("Could not load accounts.");
      setAccounts([]);
      setAccountsLoading(false);
      return;
    }

    const nextAccounts = Array.isArray(body.accounts)
      ? (body.accounts as Account[])
      : [];
    setAccounts(nextAccounts);

    setSelectedAccountId((current) => {
      if (current && nextAccounts.some((account) => account.id === current)) {
        return current;
      }

      return nextAccounts[0]?.id ?? "";
    });

    setAccountsLoading(false);
  }, []);

  const loadReviewData = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);

    const [categoriesResponse, reviewResponse] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/categorization/review"),
    ]);

    const categoriesBody = await categoriesResponse.json().catch(() => null);
    const reviewBody = await reviewResponse.json().catch(() => null);

    if (
      !categoriesResponse.ok ||
      !categoriesBody ||
      typeof categoriesBody !== "object" ||
      !("categories" in categoriesBody)
    ) {
      setReviewError("Could not load categories for review.");
      setCategories([]);
      setReviewItems([]);
      setDecisionsByTransactionId({});
      setReviewLoading(false);
      return;
    }

    if (
      !reviewResponse.ok ||
      !reviewBody ||
      typeof reviewBody !== "object" ||
      !("items" in reviewBody)
    ) {
      setReviewError("Could not load pending category reviews.");
      setCategories(
        Array.isArray(categoriesBody.categories)
          ? (categoriesBody.categories as Category[])
          : [],
      );
      setReviewItems([]);
      setDecisionsByTransactionId({});
      setReviewLoading(false);
      return;
    }

    const nextCategories = Array.isArray(categoriesBody.categories)
      ? (categoriesBody.categories as Category[])
      : [];
    const nextReviewItems = Array.isArray(reviewBody.items)
      ? (reviewBody.items as ReviewItem[])
      : [];

    setCategories(nextCategories);
    setReviewItems(nextReviewItems);
    setDecisionsByTransactionId(buildInitialDecisions(nextReviewItems));
    setReviewLoading(false);
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);

    const params = new URLSearchParams();
    if (dashboardAccountId) {
      params.set("accountId", dashboardAccountId);
    }
    if (dashboardStartDate) {
      params.set("startDate", dashboardStartDate);
    }
    if (dashboardEndDate) {
      params.set("endDate", dashboardEndDate);
    }

    const query = params.toString();
    const response = await fetch(
      `/api/dashboard/analytics${query ? `?${query}` : ""}`,
    );
    const body = await response.json().catch(() => null);

    if (!response.ok || !body || typeof body !== "object") {
      setDashboardError("Could not load dashboard analytics.");
      setDashboardData(null);
      setDashboardLoading(false);
      return;
    }

    setDashboardData(body as DashboardAnalytics);
    setDashboardLoading(false);
  }, [dashboardAccountId, dashboardEndDate, dashboardStartDate]);

  useEffect(() => {
    void loadAccounts();
    void loadReviewData();
    void loadDashboard();
  }, [loadAccounts, loadDashboard, loadReviewData]);

  async function createAccount() {
    if (!newAccountName.trim()) {
      setAccountError("Account name is required.");
      return;
    }

    setBusyAccountId("new");
    setAccountError(null);

    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: newAccountName.trim(),
        institution: newAccountInstitution.trim() || undefined,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setAccountError(getErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setNewAccountName("");
    setNewAccountInstitution("");
    setBusyAccountId(null);
    await loadAccounts();
  }

  function startEdit(account: Account) {
    setEditingAccountId(account.id);
    setEditName(account.name);
    setEditInstitution(account.institution ?? "");
  }

  async function saveEdit(accountId: string) {
    if (!editName.trim()) {
      setAccountError("Account name is required.");
      return;
    }

    setBusyAccountId(accountId);
    setAccountError(null);

    const response = await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: editName.trim(),
        institution: editInstitution.trim() || null,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setAccountError(getErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setEditingAccountId(null);
    setBusyAccountId(null);
    await loadAccounts();
  }

  async function deleteAccount(accountId: string) {
    if (!window.confirm("Delete this account?")) {
      return;
    }

    setBusyAccountId(accountId);
    setAccountError(null);

    const response = await fetch(`/api/accounts/${accountId}`, {
      method: "DELETE",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok && response.status !== 204) {
      setAccountError(getErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setBusyAccountId(null);
    await loadAccounts();
  }

  async function importCsv() {
    if (!selectedAccountId) {
      setImportError("Select an account before importing.");
      return;
    }

    if (!selectedFile) {
      setImportError("Choose a CSV file to import.");
      return;
    }

    setImportLoading(true);
    setImportError(null);

    const formData = new FormData();
    formData.set("accountId", selectedAccountId);
    formData.set("file", selectedFile);

    const response = await fetch("/api/imports", {
      method: "POST",
      body: formData,
    });

    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("summary" in body)
    ) {
      setImportError(getErrorMessage(response.status, body));
      setImportResult(null);
      setImportLoading(false);
      return;
    }

    setImportResult(body as ImportResponse);
    setImportLoading(false);
  }

  function changeDecision(transactionId: string, categoryId: string) {
    setDecisionsByTransactionId((current) => ({
      ...current,
      [transactionId]: categoryId,
    }));
  }

  function bulkAcceptSuggested() {
    setDecisionsByTransactionId(buildInitialDecisions(reviewItems));
    setReviewNotice("Applied suggested categories to all pending rows.");
    setReviewError(null);
  }

  async function submitReview() {
    if (reviewItems.length === 0) {
      return;
    }

    const decisions = reviewItems
      .map((item) => ({
        transactionId: item.transaction.id,
        categoryId:
          decisionsByTransactionId[item.transaction.id] ??
          item.suggestion.category.id,
      }))
      .filter((item) => item.categoryId);

    if (decisions.length === 0) {
      setReviewError("Choose a category for at least one row.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);
    setReviewNotice(null);

    const response = await fetch("/api/categorization/review", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ decisions }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok || !body || typeof body !== "object") {
      setReviewError(getReviewErrorMessage(response.status, body));
      setReviewSubmitting(false);
      return;
    }

    const updated =
      "updated" in body && typeof body.updated === "number" ? body.updated : 0;
    const skipped =
      "skipped" in body && typeof body.skipped === "number" ? body.skipped : 0;

    setReviewNotice(
      `Submitted review decisions. Updated ${updated}, skipped ${skipped}.`,
    );
    setReviewSubmitting(false);
    await loadReviewData();
  }

  function setDashboardPreset(preset: Exclude<DashboardRangePreset, "custom">) {
    const range = getPresetRange(preset);
    setDashboardRangePreset(preset);
    setDashboardStartDate(range.startDate);
    setDashboardEndDate(range.endDate);
  }

  const hasAccounts = accounts.length > 0;
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );
  const maxNetMagnitude = useMemo(() => {
    if (!dashboardData || dashboardData.netCashflow.length === 0) {
      return 1;
    }

    return Math.max(
      ...dashboardData.netCashflow.map((point) => Math.abs(point.netNok)),
      1,
    );
  }, [dashboardData]);
  const maxCategorySpend = useMemo(() => {
    if (!dashboardData || dashboardData.categoryBreakdown.length === 0) {
      return 1;
    }

    return Math.max(
      ...dashboardData.categoryBreakdown.map((point) => point.spendNok),
      1,
    );
  }, [dashboardData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 via-white to-zinc-50 px-5 py-8 text-zinc-900 md:px-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
            Inflation Station
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Accounts, Imports, and Review
          </h1>
          <p className="text-sm text-zinc-600">
            Manage accounts, import transactions, and finalize category
            decisions.
          </p>
        </header>

        <Card>
          <div className="space-y-1">
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              Track net cashflow, inflow and outflow, category spending, and
              account trends.
            </CardDescription>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="dashboard-account-filter"
                className="text-sm font-medium text-zinc-800"
              >
                Account filter
              </label>
              <Select
                id="dashboard-account-filter"
                value={dashboardAccountId}
                onChange={(event) => setDashboardAccountId(event.target.value)}
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-800">Date range</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={
                    dashboardRangePreset === "30d" ? "default" : "outline"
                  }
                  onClick={() => setDashboardPreset("30d")}
                  aria-pressed={dashboardRangePreset === "30d"}
                >
                  Last 30 days
                </Button>
                <Button
                  variant={
                    dashboardRangePreset === "90d" ? "default" : "outline"
                  }
                  onClick={() => setDashboardPreset("90d")}
                  aria-pressed={dashboardRangePreset === "90d"}
                >
                  Last 90 days
                </Button>
                <Button
                  variant={
                    dashboardRangePreset === "ytd" ? "default" : "outline"
                  }
                  onClick={() => setDashboardPreset("ytd")}
                  aria-pressed={dashboardRangePreset === "ytd"}
                >
                  Year to date
                </Button>
                <Button
                  variant={
                    dashboardRangePreset === "custom" ? "default" : "outline"
                  }
                  onClick={() => setDashboardRangePreset("custom")}
                  aria-pressed={dashboardRangePreset === "custom"}
                >
                  Custom
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="dashboard-start-date"
                className="text-sm font-medium text-zinc-800"
              >
                Start date
              </label>
              <Input
                id="dashboard-start-date"
                type="date"
                value={dashboardStartDate}
                onChange={(event) => {
                  setDashboardRangePreset("custom");
                  setDashboardStartDate(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="dashboard-end-date"
                className="text-sm font-medium text-zinc-800"
              >
                End date
              </label>
              <Input
                id="dashboard-end-date"
                type="date"
                value={dashboardEndDate}
                onChange={(event) => {
                  setDashboardRangePreset("custom");
                  setDashboardEndDate(event.target.value);
                }}
              />
            </div>
          </div>

          {dashboardError ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {dashboardError}
            </p>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900">
                Net Cashflow
              </h3>
              {dashboardLoading ? (
                <p className="mt-3 text-sm text-zinc-600">
                  Loading chart data...
                </p>
              ) : null}
              {!dashboardLoading &&
              (!dashboardData || dashboardData.netCashflow.length === 0) ? (
                <p className="mt-3 text-sm text-zinc-600">
                  No data for selected filters.
                </p>
              ) : null}
              {!dashboardLoading && dashboardData ? (
                <ul className="mt-3 space-y-2">
                  {dashboardData.netCashflow.map((point) => {
                    const width = Math.max(
                      6,
                      (Math.abs(point.netNok) / maxNetMagnitude) * 100,
                    );
                    const positive = point.netNok >= 0;

                    return (
                      <li key={point.date} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-zinc-600">
                          <span>{point.date}</span>
                          <span>{formatNok(point.netNok)}</span>
                        </div>
                        <div className="h-2 rounded bg-zinc-200">
                          <div
                            className={
                              positive
                                ? "h-2 rounded bg-emerald-600"
                                : "h-2 rounded bg-rose-600"
                            }
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>

            <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900">
                Inflow vs Outflow
              </h3>
              {!dashboardLoading &&
              (!dashboardData || dashboardData.inflowOutflow.length === 0) ? (
                <p className="mt-3 text-sm text-zinc-600">
                  No data for selected filters.
                </p>
              ) : null}
              {!dashboardLoading && dashboardData ? (
                <div className="mt-3 overflow-x-auto">
                  <Table>
                    <THead>
                      <tr>
                        <TH>Date</TH>
                        <TH className="text-right">Inflow</TH>
                        <TH className="text-right">Outflow</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {dashboardData.inflowOutflow.map((point) => (
                        <tr key={point.date}>
                          <TD>{point.date}</TD>
                          <TD className="text-right text-emerald-700">
                            {formatNok(point.inflowNok)}
                          </TD>
                          <TD className="text-right text-rose-700">
                            {formatNok(point.outflowNok)}
                          </TD>
                        </tr>
                      ))}
                    </TBody>
                  </Table>
                </div>
              ) : null}
            </section>

            <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900">
                Category Spend Breakdown
              </h3>
              {!dashboardLoading &&
              (!dashboardData ||
                dashboardData.categoryBreakdown.length === 0) ? (
                <p className="mt-3 text-sm text-zinc-600">
                  No spending data for selected filters.
                </p>
              ) : null}
              {!dashboardLoading && dashboardData ? (
                <ul className="mt-3 space-y-2">
                  {dashboardData.categoryBreakdown.map((point) => {
                    const width = Math.max(
                      6,
                      (point.spendNok / maxCategorySpend) * 100,
                    );
                    return (
                      <li key={point.categoryId ?? "uncategorized"}>
                        <div className="flex items-center justify-between text-xs text-zinc-600">
                          <span>{point.categoryName}</span>
                          <span>
                            {formatNok(point.spendNok)} (
                            {point.transactionCount})
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded bg-zinc-200">
                          <div
                            className="h-2 rounded bg-blue-600"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>

            <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900">
                Account State Trend
              </h3>
              {!dashboardLoading &&
              (!dashboardData || dashboardData.accountTrend.length === 0) ? (
                <p className="mt-3 text-sm text-zinc-600">
                  No trend data for selected filters.
                </p>
              ) : null}
              {!dashboardLoading && dashboardData ? (
                <div className="mt-3 space-y-3">
                  {dashboardData.accountTrend.map((series) => {
                    const latest = series.points.at(-1);
                    return (
                      <div
                        key={series.accountId}
                        className="rounded border border-zinc-200 bg-white p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-zinc-900">
                            {series.accountName}
                          </p>
                          <p className="text-sm text-zinc-600">
                            {latest ? formatNok(latest.cumulativeNok) : "-"}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {series.points.length} points
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="space-y-1">
              <CardTitle>Account Management</CardTitle>
              <CardDescription>
                Add, rename, and remove accounts used in imports.
              </CardDescription>
            </div>

            <div className="mt-4 grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <label
                htmlFor="new-account-name"
                className="text-sm font-medium text-zinc-800"
              >
                Account name
              </label>
              <Input
                id="new-account-name"
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
                placeholder="Spending Account"
              />
              <label
                htmlFor="new-account-institution"
                className="text-sm font-medium text-zinc-800"
              >
                Institution (optional)
              </label>
              <Input
                id="new-account-institution"
                value={newAccountInstitution}
                onChange={(event) =>
                  setNewAccountInstitution(event.target.value)
                }
                placeholder="DNB"
              />
              <Button
                onClick={createAccount}
                disabled={busyAccountId === "new"}
              >
                {busyAccountId === "new" ? "Saving..." : "Add account"}
              </Button>
            </div>

            {accountError ? (
              <p
                role="alert"
                className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {accountError}
              </p>
            ) : null}

            <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200">
              <Table>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Institution</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {accountsLoading ? (
                    <tr>
                      <TD colSpan={4}>Loading accounts...</TD>
                    </tr>
                  ) : null}
                  {!accountsLoading && !hasAccounts ? (
                    <tr>
                      <TD colSpan={4}>No accounts yet.</TD>
                    </tr>
                  ) : null}
                  {!accountsLoading
                    ? accounts.map((account) => {
                        const isEditing = editingAccountId === account.id;
                        const isBusy = busyAccountId === account.id;

                        return (
                          <tr key={account.id}>
                            <TD>
                              {isEditing ? (
                                <Input
                                  aria-label={`Edit name ${account.name}`}
                                  value={editName}
                                  onChange={(event) =>
                                    setEditName(event.target.value)
                                  }
                                />
                              ) : (
                                account.name
                              )}
                            </TD>
                            <TD>
                              {isEditing ? (
                                <Input
                                  aria-label={`Edit institution ${account.name}`}
                                  value={editInstitution}
                                  onChange={(event) =>
                                    setEditInstitution(event.target.value)
                                  }
                                />
                              ) : (
                                (account.institution ?? "-")
                              )}
                            </TD>
                            <TD>{account.isActive ? "Active" : "Inactive"}</TD>
                            <TD>
                              <div className="flex justify-end gap-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="secondary"
                                      onClick={() => saveEdit(account.id)}
                                      disabled={isBusy}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => setEditingAccountId(null)}
                                      disabled={isBusy}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="outline"
                                      onClick={() => startEdit(account)}
                                      disabled={isBusy}
                                    >
                                      Rename
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => deleteAccount(account.id)}
                                      disabled={isBusy}
                                    >
                                      Remove
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TD>
                          </tr>
                        );
                      })
                    : null}
                </TBody>
              </Table>
            </div>
          </Card>

          <Card>
            <div className="space-y-1">
              <CardTitle>CSV Upload</CardTitle>
              <CardDescription>
                Upload transactions for one selected account.
              </CardDescription>
            </div>

            <div className="mt-4 grid gap-3">
              <label
                htmlFor="account-select"
                className="text-sm font-medium text-zinc-800"
              >
                Account
              </label>
              <Select
                id="account-select"
                value={selectedAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
                disabled={!hasAccounts}
              >
                {!hasAccounts ? (
                  <option value="">No accounts available</option>
                ) : null}
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>

              <label
                htmlFor="csv-file"
                className="text-sm font-medium text-zinc-800"
              >
                CSV file
              </label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
              />

              <Button
                onClick={importCsv}
                disabled={!hasAccounts || importLoading}
              >
                {importLoading ? "Importing..." : "Import transactions"}
              </Button>
            </div>

            {importError ? (
              <p
                role="alert"
                className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {importError}
              </p>
            ) : null}

            {importResult ? (
              <section
                aria-live="polite"
                className="mt-4 space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
                  Import summary
                </h2>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-zinc-600">Imported</dt>
                    <dd className="font-semibold">
                      {importResult.summary.imported}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Duplicates</dt>
                    <dd className="font-semibold">
                      {importResult.summary.duplicates}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Ignored reserved</dt>
                    <dd className="font-semibold">
                      {importResult.summary.ignoredReserved}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Invalid</dt>
                    <dd className="font-semibold">
                      {importResult.summary.invalid}
                    </dd>
                  </div>
                </dl>

                {importResult.errors.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Validation errors
                    </h3>
                    <ul className="space-y-1 text-sm text-zinc-700">
                      {importResult.errors.map((error) => (
                        <li key={`${error.rowNumber}-${error.code}`}>
                          Row {error.rowNumber}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}
          </Card>
        </div>

        <Card>
          <div className="space-y-1">
            <CardTitle>Category Review</CardTitle>
            <CardDescription>
              Review suggested categories, edit final categories, and submit in
              bulk.
            </CardDescription>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={bulkAcceptSuggested}
              disabled={
                reviewLoading || reviewItems.length === 0 || reviewSubmitting
              }
            >
              Use suggested for all
            </Button>
            <Button
              onClick={submitReview}
              disabled={
                reviewLoading || reviewItems.length === 0 || reviewSubmitting
              }
            >
              {reviewSubmitting ? "Submitting..." : "Submit review decisions"}
            </Button>
          </div>

          {reviewError ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {reviewError}
            </p>
          ) : null}

          {reviewNotice ? (
            <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {reviewNotice}
            </p>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200">
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Merchant</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Suggested</TH>
                  <TH>Final category</TH>
                </tr>
              </THead>
              <TBody>
                {reviewLoading ? (
                  <tr>
                    <TD colSpan={5}>Loading pending reviews...</TD>
                  </tr>
                ) : null}
                {!reviewLoading && reviewItems.length === 0 ? (
                  <tr>
                    <TD colSpan={5}>No pending suggestions.</TD>
                  </tr>
                ) : null}
                {!reviewLoading
                  ? reviewItems.map((item) => (
                      <tr key={item.suggestion.id}>
                        <TD>{item.transaction.bookingDate}</TD>
                        <TD>{item.transaction.normalizedMerchant}</TD>
                        <TD className="text-right">
                          {formatNok(item.transaction.amountNok)}
                        </TD>
                        <TD>
                          <div className="font-medium text-zinc-900">
                            {item.suggestion.category.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {item.suggestion.source}
                            {typeof item.suggestion.confidence === "number"
                              ? ` (${Math.round(item.suggestion.confidence * 100)}%)`
                              : ""}
                          </div>
                        </TD>
                        <TD>
                          <Select
                            aria-label={`Final category for ${item.transaction.normalizedMerchant}`}
                            value={
                              decisionsByTransactionId[item.transaction.id] ??
                              item.suggestion.category.id
                            }
                            onChange={(event) =>
                              changeDecision(
                                item.transaction.id,
                                event.target.value,
                              )
                            }
                            disabled={
                              reviewSubmitting || categories.length === 0
                            }
                          >
                            {categories.length === 0 ? (
                              <option value="">No categories available</option>
                            ) : null}
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </Select>
                        </TD>
                      </tr>
                    ))
                  : null}
              </TBody>
            </Table>
          </div>
        </Card>
      </main>
    </div>
  );
}

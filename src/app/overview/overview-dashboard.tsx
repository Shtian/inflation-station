"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Account = {
  id: string;
  name: string;
};

type DashboardRangePreset = "30d" | "90d" | "ytd" | "custom";

type DashboardAnalytics = {
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

export function OverviewDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
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

    const nextAccounts = (body.accounts as Account[]).map((account) => ({
      id: account.id,
      name: account.name,
    }));

    setAccounts(nextAccounts);
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
  }, [loadAccounts]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  function setDashboardPreset(preset: Exclude<DashboardRangePreset, "custom">) {
    const range = getPresetRange(preset);
    setDashboardRangePreset(preset);
    setDashboardStartDate(range.startDate);
    setDashboardEndDate(range.endDate);
  }

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
    <Card>
      <div className="space-y-1">
        <CardTitle>Overview</CardTitle>
        <CardDescription>
          Track net cashflow, inflow and outflow, category spending, and account
          trends.
        </CardDescription>
      </div>

      <Separator className="my-4" />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="dashboard-account-filter"
            className="text-sm font-medium text-foreground"
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
          <p className="text-sm font-medium text-foreground">Date range</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={dashboardRangePreset === "30d" ? "default" : "outline"}
              onClick={() => setDashboardPreset("30d")}
              aria-pressed={dashboardRangePreset === "30d"}
            >
              Last 30 days
            </Button>
            <Button
              variant={dashboardRangePreset === "90d" ? "default" : "outline"}
              onClick={() => setDashboardPreset("90d")}
              aria-pressed={dashboardRangePreset === "90d"}
            >
              Last 90 days
            </Button>
            <Button
              variant={dashboardRangePreset === "ytd" ? "default" : "outline"}
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
            className="text-sm font-medium text-foreground"
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
            className="text-sm font-medium text-foreground"
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

      <Separator className="my-4" />

      <div className="space-y-4">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Net Cashflow
          </h3>
          {dashboardLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Loading chart data...
            </p>
          ) : null}
          {!dashboardLoading &&
          (!dashboardData || dashboardData.netCashflow.length === 0) ? (
            <p className="mt-3 text-sm text-muted-foreground">
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
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{point.date}</span>
                      <span>{formatNok(point.netNok)}</span>
                    </div>
                    <div className="h-2 rounded bg-muted">
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

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Inflow vs Outflow
          </h3>
          {!dashboardLoading &&
          (!dashboardData || dashboardData.inflowOutflow.length === 0) ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No data for selected filters.
            </p>
          ) : null}
          {!dashboardLoading && dashboardData ? (
            <div className="mt-3 overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Inflow</TableHead>
                    <TableHead className="text-right">Outflow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.inflowOutflow.map((point) => (
                    <TableRow key={point.date}>
                      <TableCell>{point.date}</TableCell>
                      <TableCell className="text-right text-emerald-700">
                        {formatNok(point.inflowNok)}
                      </TableCell>
                      <TableCell className="text-right text-rose-700">
                        {formatNok(point.outflowNok)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Category Spend Breakdown
          </h3>
          {!dashboardLoading &&
          (!dashboardData || dashboardData.categoryBreakdown.length === 0) ? (
            <p className="mt-3 text-sm text-muted-foreground">
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
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{point.categoryName}</span>
                      <span>
                        {formatNok(point.spendNok)} ({point.transactionCount})
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded bg-muted">
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

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Account State Trend
          </h3>
          {!dashboardLoading &&
          (!dashboardData || dashboardData.accountTrend.length === 0) ? (
            <p className="mt-3 text-sm text-muted-foreground">
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
                    className="rounded border border-border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {series.accountName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {latest ? formatNok(latest.cumulativeNok) : "-"}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
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
  );
}

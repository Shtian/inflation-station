"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
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
import { Separator } from "@/components/ui/separator";
import { getCategoryColor } from "@/lib/category-color";
import { cn } from "@/lib/utils";

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

const ALL_ACCOUNTS_VALUE = "__all_accounts__";

function formatNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatTooltipNok(value: unknown) {
  if (typeof value === "number") {
    return formatNok(value);
  }

  return formatNok(Number.parseFloat(String(value)) || 0);
}

function formatChartDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatFullDate(value: string) {
  const date = fromDateInputValue(value);
  if (!date) {
    return "Pick a date";
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
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
  const [customDatePopoverOpen, setCustomDatePopoverOpen] = useState(false);

  const netCashflowChartConfig = {
    netNok: { label: "Net cashflow" },
    positive: { label: "Inflow", color: "var(--chart-2)" },
    negative: { label: "Outflow", color: "var(--destructive)" },
  };

  const inflowOutflowChartConfig = {
    inflowNok: { label: "Inflow", color: "var(--chart-2)" },
    outflowNok: { label: "Outflow", color: "var(--destructive)" },
  };

  const categoryBreakdownChartConfig = {
    spendNok: { label: "Spend", color: "var(--chart-3)" },
  };

  const accountTrendChartConfig = {
    cumulativeNok: {
      label: "Cumulative balance",
      color: "var(--chart-1)",
    },
  };

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

  const topCategories = useMemo(
    () => (dashboardData ? dashboardData.categoryBreakdown.slice(0, 5) : []),
    [dashboardData],
  );
  const selectedCustomRange = useMemo<DateRange | undefined>(() => {
    const from = fromDateInputValue(dashboardStartDate);
    const to = fromDateInputValue(dashboardEndDate);

    if (!from && !to) {
      return undefined;
    }

    return { from, to };
  }, [dashboardEndDate, dashboardStartDate]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Track net cashflow, inflow and outflow, category spending, and account
          trends.
        </p>
      </div>

      <Separator className="my-4" />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="dashboard-account-filter"
            className="block text-sm font-medium text-foreground"
          >
            Account filter
          </label>
          <Select
            value={dashboardAccountId || ALL_ACCOUNTS_VALUE}
            onValueChange={(value) =>
              setDashboardAccountId(value === ALL_ACCOUNTS_VALUE ? "" : value)
            }
          >
            <SelectTrigger id="dashboard-account-filter" className="w-full">
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
          <p className="text-sm font-medium text-foreground">Date range</p>
          <ButtonGroup className="flex w-full flex-wrap gap-2 md:flex-nowrap md:gap-0.5">
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
            <Popover
              open={customDatePopoverOpen}
              onOpenChange={setCustomDatePopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant={
                    dashboardRangePreset === "custom" ? "default" : "outline"
                  }
                  onClick={() => setDashboardRangePreset("custom")}
                  aria-pressed={dashboardRangePreset === "custom"}
                >
                  Custom
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={selectedCustomRange}
                  defaultMonth={selectedCustomRange?.from}
                  numberOfMonths={2}
                  onSelect={(range) => {
                    if (!range?.from) {
                      return;
                    }

                    setDashboardRangePreset("custom");
                    setDashboardStartDate(toDateInputValue(range.from));

                    if (range.to) {
                      setDashboardEndDate(toDateInputValue(range.to));
                      setCustomDatePopoverOpen(false);
                    } else {
                      setDashboardEndDate(toDateInputValue(range.from));
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </ButtonGroup>
          <p
            className={cn(
              "text-xs text-muted-foreground",
              dashboardRangePreset !== "custom" && "hidden",
            )}
          >
            {formatFullDate(dashboardStartDate)} -{" "}
            {formatFullDate(dashboardEndDate)}
          </p>
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
            <ChartContainer
              config={netCashflowChartConfig}
              className="mt-3 h-64 w-full"
            >
              <BarChart accessibilityLayer data={dashboardData.netCashflow}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickFormatter={formatChartDate}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCompactNok}
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      formatter={formatTooltipNok}
                      labelFormatter={formatChartDate}
                    />
                  }
                />
                <Bar dataKey="netNok" radius={4}>
                  {dashboardData.netCashflow.map((point) => (
                    <Cell
                      key={point.date}
                      fill={
                        point.netNok >= 0
                          ? "var(--color-positive)"
                          : "var(--color-negative)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
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
            <ChartContainer
              config={inflowOutflowChartConfig}
              className="mt-3 h-64 w-full"
            >
              <BarChart accessibilityLayer data={dashboardData.inflowOutflow}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickFormatter={formatChartDate}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCompactNok}
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      formatter={formatTooltipNok}
                      labelFormatter={formatChartDate}
                    />
                  }
                />
                <Legend />
                <Bar
                  dataKey="inflowNok"
                  fill="var(--color-inflowNok)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="outflowNok"
                  fill="var(--color-outflowNok)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
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
            <div className="mt-3 space-y-3">
              <ChartContainer
                config={categoryBreakdownChartConfig}
                className="h-64 w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={dashboardData.categoryBreakdown}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="categoryName"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCompactNok}
                  />
                  <Tooltip
                    content={
                      <ChartTooltipContent formatter={formatTooltipNok} />
                    }
                  />
                  <Bar
                    dataKey="spendNok"
                    fill="var(--color-spendNok)"
                    radius={4}
                  >
                    {dashboardData.categoryBreakdown.map((point) => (
                      <Cell
                        key={`${point.categoryId ?? "uncategorized"}-${point.categoryName}`}
                        fill={
                          getCategoryColor(point.categoryName, "muted").backgroundColor
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              <div className="space-y-1 text-xs text-muted-foreground">
                {topCategories.map((point) => (
                  <p key={point.categoryId ?? "uncategorized"}>
                    {point.categoryName}: {formatNok(point.spendNok)} (
                    {point.transactionCount})
                  </p>
                ))}
              </div>
            </div>
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
                    <ChartContainer
                      config={accountTrendChartConfig}
                      className="mt-3 h-44 w-full"
                    >
                      <LineChart accessibilityLayer data={series.points}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          minTickGap={24}
                          tickFormatter={formatChartDate}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatCompactNok}
                        />
                        <Tooltip
                          content={
                            <ChartTooltipContent
                              indicator="line"
                              formatter={formatTooltipNok}
                              labelFormatter={formatChartDate}
                            />
                          }
                        />
                        <Line
                          dataKey="cumulativeNok"
                          type="monotone"
                          stroke="var(--color-cumulativeNok)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ChartContainer>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {series.points.length} points
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

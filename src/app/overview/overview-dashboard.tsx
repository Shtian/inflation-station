"use client";

import { useMemo } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCategoryColor } from "@/lib/category-color";
import { cn } from "@/lib/utils";
import {
  ALL_ACCOUNTS_VALUE,
  formatChartDate,
  formatCompactNok,
  formatFullDate,
  formatNok,
  formatTooltipNok,
  fromDateInputValue,
} from "./overview-dashboard.utils";
import { useOverviewDashboard } from "./use-overview-dashboard";

export function OverviewDashboard() {
  const {
    accounts,
    dashboardAccountId,
    dashboardRangePreset,
    dashboardStartDate,
    dashboardEndDate,
    dashboardLoading,
    dashboardError,
    dashboardData,
    customDatePopoverOpen,
    setDashboardAccountId,
    setDashboardRangePreset,
    setCustomDatePopoverOpen,
    setDashboardPreset,
    setCustomDateRange,
  } = useOverviewDashboard();

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
          <ButtonGroup>
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
                    setCustomDateRange(range);
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

      <Tabs defaultValue="flow" className="space-y-4">
        <TabsList variant="line">
          <TabsTrigger value="flow">Flow</TabsTrigger>
          <TabsTrigger value="category">Category</TabsTrigger>
        </TabsList>

        <TabsContent value="flow" className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
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
                  <BarChart
                    accessibilityLayer
                    data={dashboardData.inflowOutflow}
                  >
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
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
                      <div key={series.accountId} className="rounded p-3">
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
                              domain={[
                                (dataMin: number) => Math.min(dataMin, 0),
                                (dataMax: number) => Math.max(dataMax, 0),
                              ]}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Category Spend Breakdown
              </h3>
              {dashboardLoading ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Loading chart data...
                </p>
              ) : null}
              {!dashboardLoading &&
              (!dashboardData ||
                dashboardData.categoryBreakdown.length === 0) ? (
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
                              getCategoryColor(point.categoryName, "muted")
                                .backgroundColor
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { AccountStateTrendCard } from "./components/account-state-trend-card";
import { CategorySpendBreakdownCard } from "./components/category-spend-breakdown-card";
import { InflowOutflowCard } from "./components/inflow-outflow-card";
import { NetCashflowCard } from "./components/net-cashflow-card";
import {
  ALL_ACCOUNTS_VALUE,
  formatFullDate,
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
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Overview
        </h1>
        <p className="text-muted-foreground text-sm">
          Track net cashflow, inflow and outflow, category spending, and account
          trends.
        </p>
      </div>

      <Separator className="my-4" />

      <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
        Transfer-category transactions are excluded from spend and income
        analytics.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="dashboard-account-filter"
            className="block font-medium text-foreground text-sm"
          >
            Account filter
          </Label>
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
          <p className="font-medium text-foreground text-sm">Date range</p>
          <ButtonGroup>
            <Button
              variant={dashboardRangePreset === "all" ? "default" : "outline"}
              onClick={() => setDashboardPreset("all")}
              aria-pressed={dashboardRangePreset === "all"}
            >
              All time
            </Button>
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
              "text-muted-foreground text-xs",
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
          className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
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
          <NetCashflowCard
            isLoading={dashboardLoading}
            netCashflow={dashboardData?.netCashflow}
          />
          <InflowOutflowCard
            isLoading={dashboardLoading}
            inflowOutflow={dashboardData?.inflowOutflow}
          />
          <AccountStateTrendCard
            isLoading={dashboardLoading}
            accountTrend={dashboardData?.accountTrend}
          />
        </TabsContent>

        <TabsContent value="category" className="space-y-4">
          <CategorySpendBreakdownCard
            isLoading={dashboardLoading}
            categoryBreakdown={dashboardData?.categoryBreakdown}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

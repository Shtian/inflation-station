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
          Oversikt
        </h1>
        <p className="text-muted-foreground text-sm">
          Følg netto kontantstrøm, inn og ut, forbruk per kategori og
          kontoutvikling.
        </p>
      </div>

      <Separator className="my-4" />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="dashboard-account-filter"
            className="block font-medium text-foreground text-sm"
          >
            Kontofilter
          </Label>
          <Select
            items={[
              { value: ALL_ACCOUNTS_VALUE, label: "Alle kontoer" },
              ...accounts.map((account) => ({
                value: account.id,
                label: account.name,
              })),
            ]}
            value={dashboardAccountId || ALL_ACCOUNTS_VALUE}
            onValueChange={(value) => {
              if (value === null) return;
              setDashboardAccountId(value === ALL_ACCOUNTS_VALUE ? "" : value);
            }}
          >
            <SelectTrigger id="dashboard-account-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACCOUNTS_VALUE}>Alle kontoer</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p
            id="date-range-label"
            className="font-medium text-foreground text-sm"
          >
            Datoperiode
          </p>
          <ButtonGroup role="group" aria-labelledby="date-range-label">
            <Button
              variant={dashboardRangePreset === "30d" ? "default" : "outline"}
              onClick={() => setDashboardPreset("30d")}
              aria-pressed={dashboardRangePreset === "30d"}
            >
              Siste 30 dager
            </Button>
            <Button
              variant={dashboardRangePreset === "90d" ? "default" : "outline"}
              onClick={() => setDashboardPreset("90d")}
              aria-pressed={dashboardRangePreset === "90d"}
            >
              Siste 90 dager
            </Button>
            <Button
              variant={dashboardRangePreset === "ytd" ? "default" : "outline"}
              onClick={() => setDashboardPreset("ytd")}
              aria-pressed={dashboardRangePreset === "ytd"}
            >
              Hittil i år
            </Button>
            <Popover
              open={customDatePopoverOpen}
              onOpenChange={setCustomDatePopoverOpen}
            >
              <PopoverTrigger
                render={
                  <Button
                    variant={
                      dashboardRangePreset === "custom" ? "default" : "outline"
                    }
                    onClick={() => setDashboardRangePreset("custom")}
                    aria-pressed={dashboardRangePreset === "custom"}
                  >
                    Egendefinert
                  </Button>
                }
              />
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

      <Tabs defaultValue="category" className="space-y-4">
        <TabsList variant="line">
          <TabsTrigger value="category">Kategori</TabsTrigger>
          <TabsTrigger value="flow">Flyt</TabsTrigger>
        </TabsList>

        <TabsContent value="category" className="space-y-4">
          <CategorySpendBreakdownCard
            isLoading={dashboardLoading}
            categoryBreakdown={dashboardData?.categoryBreakdown}
            filterKey={`${dashboardAccountId}|${dashboardStartDate}|${dashboardEndDate}`}
          />
        </TabsContent>

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
      </Tabs>
    </div>
  );
}

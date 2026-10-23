"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountStateTrendCard } from "./components/account-state-trend-card";
import { CategorySpendBreakdownCard } from "./components/category-spend-breakdown-card";
import { DashboardPeriodFilter } from "./components/dashboard-period-filter";
import { InflowOutflowCard } from "./components/inflow-outflow-card";
import { NetCashflowCard } from "./components/net-cashflow-card";
import { ALL_ACCOUNTS_VALUE, formatFullDate } from "./overview-dashboard.utils";
import { useOverviewDashboard } from "./use-overview-dashboard";

export function OverviewDashboard() {
  const {
    accounts,
    dashboardAccountId,
    period,
    dashboardRange,
    today,
    dashboardLoading,
    dashboardError,
    dashboardData,
    setDashboardAccountId,
    selectPeriod,
  } = useOverviewDashboard();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Oversikt
        </h1>
        <p className="text-sm text-muted-foreground">
          Følg netto kontantstrøm, inn og ut, forbruk per kategori og
          kontoutvikling.
        </p>
      </div>

      <Separator className="my-4" />

      <div className="space-y-3">
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,14rem)_1fr]">
          <div className="space-y-2">
            <Label
              htmlFor="dashboard-account-filter"
              className="flex h-8 text-sm font-medium text-foreground"
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
                setDashboardAccountId(
                  value === ALL_ACCOUNTS_VALUE ? "" : value,
                );
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

          <DashboardPeriodFilter
            period={period}
            range={dashboardRange}
            today={today}
            onSelect={selectPeriod}
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatFullDate(dashboardRange.startDate)} –{" "}
          {formatFullDate(dashboardRange.endDate)}
        </p>
      </div>

      {dashboardError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
            filterKey={`${dashboardAccountId}|${dashboardRange.startDate}|${dashboardRange.endDate}`}
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

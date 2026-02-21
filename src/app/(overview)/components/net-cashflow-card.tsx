import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { DashboardAnalytics } from "../overview-dashboard.types";
import {
  formatChartDate,
  formatCompactNok,
  formatTooltipNok,
} from "../overview-dashboard.utils";

type NetCashflowCardProps = {
  isLoading: boolean;
  netCashflow: DashboardAnalytics["netCashflow"] | undefined;
};

const netCashflowChartConfig = {
  netNok: { label: "Net cashflow" },
  positive: { label: "Inflow", color: "var(--chart-2)" },
  negative: { label: "Outflow", color: "var(--destructive)" },
};

export function NetCashflowCard({
  isLoading,
  netCashflow,
}: NetCashflowCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <h3 className="font-semibold text-foreground text-sm">Net Cashflow</h3>
        {isLoading ? (
          <p className="mt-3 text-muted-foreground text-sm">
            Loading chart data...
          </p>
        ) : null}
        {!isLoading && (!netCashflow || netCashflow.length === 0) ? (
          <p className="mt-3 text-muted-foreground text-sm">
            No data for selected filters.
          </p>
        ) : null}
        {!isLoading && netCashflow ? (
          <ChartContainer
            config={netCashflowChartConfig}
            className="mt-3 h-64 w-full"
          >
            <BarChart accessibilityLayer data={netCashflow}>
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
                {netCashflow.map((point) => (
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
  );
}

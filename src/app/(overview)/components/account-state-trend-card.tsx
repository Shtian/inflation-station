import {
  CartesianGrid,
  Line,
  LineChart,
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
  formatNok,
  formatTooltipNok,
} from "../overview-dashboard.utils";

type AccountStateTrendCardProps = {
  isLoading: boolean;
  accountTrend: DashboardAnalytics["accountTrend"] | undefined;
};

const accountTrendChartConfig = {
  cumulativeNok: {
    label: "Cumulative balance",
    color: "var(--chart-1)",
  },
};

export function AccountStateTrendCard({
  isLoading,
  accountTrend,
}: AccountStateTrendCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Account State Trend
        </h3>
        {!isLoading && (!accountTrend || accountTrend.length === 0) ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No trend data for selected filters.
          </p>
        ) : null}
        {!isLoading && accountTrend ? (
          <div className="mt-3 space-y-3">
            {accountTrend.map((series) => {
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
  );
}

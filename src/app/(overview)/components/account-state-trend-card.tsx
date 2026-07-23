import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
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
    color: "var(--brand)",
  },
};

export function AccountStateTrendCard({
  isLoading,
  accountTrend,
}: AccountStateTrendCardProps) {
  return (
    <div className="space-y-3">
      <Separator />
      <h3 className="font-semibold text-foreground text-sm">
        Account State Trend
      </h3>
      {!isLoading && (!accountTrend || accountTrend.length === 0) ? (
        <p className="text-muted-foreground text-sm">
          No trend data for selected filters.
        </p>
      ) : null}
      {!isLoading && accountTrend ? (
        <div className="space-y-3">
          {accountTrend.map((series) => {
            const latest = series.points.at(-1);
            return (
              <div
                key={series.accountId}
                className="rounded-md border border-border/70 bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground text-sm">
                    {series.accountName}
                  </p>
                  <p className="text-muted-foreground text-sm">
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
                          labelFormatter={(label) =>
                            formatChartDate(String(label))
                          }
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
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

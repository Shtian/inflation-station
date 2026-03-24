import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

type InflowOutflowCardProps = {
  isLoading: boolean;
  inflowOutflow: DashboardAnalytics["inflowOutflow"] | undefined;
};

const inflowOutflowChartConfig = {
  inflowNok: { label: "Inflow", color: "var(--chart-2)" },
  outflowNok: { label: "Outflow", color: "var(--destructive)" },
};

export function InflowOutflowCard({
  isLoading,
  inflowOutflow,
}: InflowOutflowCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <h3 className="font-semibold text-foreground text-sm">
          Inflow vs Outflow
        </h3>
        {isLoading ? (
          <output className="mt-3 block text-muted-foreground text-sm">
            Loading chart data...
          </output>
        ) : null}
        {!isLoading && (!inflowOutflow || inflowOutflow.length === 0) ? (
          <p className="mt-3 text-muted-foreground text-sm">
            No data for selected filters.
          </p>
        ) : null}
        {!isLoading && inflowOutflow ? (
          <ChartContainer
            config={inflowOutflowChartConfig}
            className="mt-3 h-64 w-full"
          >
            <BarChart accessibilityLayer data={inflowOutflow}>
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
  );
}

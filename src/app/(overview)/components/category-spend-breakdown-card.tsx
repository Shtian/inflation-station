import { useMemo } from "react";
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
import { getCategoryColor } from "@/lib/category-color";
import type { DashboardAnalytics } from "../overview-dashboard.types";
import {
  formatCompactNok,
  formatNok,
  formatTooltipNok,
} from "../overview-dashboard.utils";

type CategorySpendBreakdownCardProps = {
  isLoading: boolean;
  categoryBreakdown: DashboardAnalytics["categoryBreakdown"] | undefined;
};

const categoryBreakdownChartConfig = {
  spendNok: { label: "Spend", color: "var(--chart-3)" },
};

export function CategorySpendBreakdownCard({
  isLoading,
  categoryBreakdown,
}: CategorySpendBreakdownCardProps) {
  const topCategories = useMemo(
    () => (categoryBreakdown ? categoryBreakdown.slice(0, 5) : []),
    [categoryBreakdown],
  );

  return (
    <Card>
      <CardContent className="space-y-3">
        <h3 className="font-semibold text-foreground text-sm">
          Category Spend Breakdown
        </h3>
        {isLoading ? (
          <output className="mt-3 block text-muted-foreground text-sm">
            Loading chart data...
          </output>
        ) : null}
        {!isLoading &&
        (!categoryBreakdown || categoryBreakdown.length === 0) ? (
          <p className="mt-3 text-muted-foreground text-sm">
            No spending data for selected filters.
          </p>
        ) : null}
        {!isLoading && categoryBreakdown ? (
          <div className="mt-3 space-y-3">
            <ChartContainer
              config={categoryBreakdownChartConfig}
              className="h-64 w-full"
            >
              <BarChart accessibilityLayer data={categoryBreakdown}>
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
                  content={<ChartTooltipContent formatter={formatTooltipNok} />}
                />
                <Bar dataKey="spendNok" fill="var(--color-spendNok)" radius={4}>
                  {categoryBreakdown.map((point) => (
                    <Cell
                      key={`${point.categoryId ?? "uncategorized"}-${point.categoryName}`}
                      fill={
                        getCategoryColor(point.categoryName).backgroundColor
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="space-y-1 text-muted-foreground text-xs">
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
  );
}

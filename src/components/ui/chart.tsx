import * as React from "react";
import { CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
  }
>;

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

type ChartContainerProps = React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
};

export function ChartContainer({
  className,
  config,
  children,
  style,
  ...props
}: ChartContainerProps) {
  const colorStyle: React.CSSProperties = { ...style };

  for (const [key, itemConfig] of Object.entries(config)) {
    if (itemConfig.color) {
      (colorStyle as Record<string, string | number | undefined>)[
        `--color-${key}`
      ] = itemConfig.color;
    }
  }

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart-container"
        style={colorStyle}
        className={cn(
          "flex aspect-video items-center justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-text]:fill-foreground",
          className,
        )}
        {...props}
      >
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

type ChartTooltipContentProps = React.ComponentProps<"div"> & {
  active?: boolean;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    value?: number | string;
  }>;
  label?: string | number;
  indicator?: "line" | "dot";
  hideLabel?: boolean;
  hideIndicator?: boolean;
  formatter?: (value: number, name: string) => React.ReactNode;
  labelFormatter?: (label: string) => React.ReactNode;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  indicator = "dot",
  hideIndicator = false,
  hideLabel = false,
  formatter,
  labelFormatter,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid min-w-[8rem] gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-xl",
        className,
      )}
    >
      {!hideLabel && label != null ? (
        <div className="font-medium text-card-foreground">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </div>
      ) : null}
      <div className="grid gap-1">
        {payload.map((item) => {
          const dataKey = String(item.dataKey);
          const itemConfig = config[dataKey];
          const indicatorColor =
            item.color ?? itemConfig?.color ?? "var(--color-muted-foreground)";
          const numericValue =
            typeof item.value === "number" ? item.value : Number(item.value);

          return (
            <div
              key={dataKey}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5">
                {hideIndicator ? null : (
                  <span
                    className={cn(
                      "shrink-0 rounded-[2px]",
                      indicator === "dot" ? "h-2 w-2" : "h-0.5 w-3",
                    )}
                    style={{ backgroundColor: indicatorColor }}
                  />
                )}
                <span className="text-muted-foreground">
                  {itemConfig?.label ?? dataKey}
                </span>
              </div>
              <span className="font-mono font-medium text-card-foreground tabular-nums">
                {formatter && Number.isFinite(numericValue)
                  ? formatter(numericValue, dataKey)
                  : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { CartesianGrid, Legend, Tooltip };

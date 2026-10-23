import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  DashboardDateRange,
  DashboardPeriod,
  DashboardRollingPreset,
} from "../overview-dashboard.types";
import {
  fromDateInputValue,
  toDateInputValue,
} from "../overview-dashboard.utils";

const MONTHS = [
  { short: "jan", long: "januar" },
  { short: "feb", long: "februar" },
  { short: "mar", long: "mars" },
  { short: "apr", long: "april" },
  { short: "mai", long: "mai" },
  { short: "jun", long: "juni" },
  { short: "jul", long: "juli" },
  { short: "aug", long: "august" },
  { short: "sep", long: "september" },
  { short: "okt", long: "oktober" },
  { short: "nov", long: "november" },
  { short: "des", long: "desember" },
];

const ROLLING_LABELS: Record<DashboardRollingPreset, string> = {
  "30d": "Siste 30 dager",
  "90d": "Siste 90 dager",
  ytd: "Hittil i år",
};
const ROLLING_ORDER: DashboardRollingPreset[] = ["30d", "90d", "ytd"];

type PopoverView = "closed" | "menu" | "calendar";

function getTriggerLabel(period: DashboardPeriod) {
  switch (period.kind) {
    case "month":
      return "Annen periode";
    case "rolling":
      return ROLLING_LABELS[period.preset];
    case "custom":
      return "Egendefinert";
  }
}

type DashboardPeriodFilterProps = {
  period: DashboardPeriod;
  range: DashboardDateRange;
  today: Date;
  onSelect: (period: DashboardPeriod) => void;
};

export function DashboardPeriodFilter({
  period,
  range,
  today,
  onSelect,
}: DashboardPeriodFilterProps) {
  const [popoverView, setPopoverView] = useState<PopoverView>("closed");
  const currentYear = today.getFullYear();
  const selectedMonthYear = period.kind === "month" ? period.year : null;
  const [shownYear, setShownYear] = useState(selectedMonthYear ?? currentYear);
  const currentMonth = today.getMonth() + 1;

  useEffect(() => {
    if (selectedMonthYear !== null) {
      setShownYear(selectedMonthYear);
    }
  }, [selectedMonthYear]);

  const selectedRange = {
    from: fromDateInputValue(range.startDate),
    to: fromDateInputValue(range.endDate),
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          id="dashboard-period-label"
          className="text-sm font-medium text-foreground"
        >
          Periode
        </p>
        <div className="flex items-center gap-2">
          <ButtonGroup aria-label="År">
            <Button
              variant="outline"
              size="icon"
              aria-label="Forrige år"
              onClick={() => setShownYear(shownYear - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <ButtonGroupText
              aria-live="polite"
              className="min-w-14 justify-center bg-background tabular-nums"
            >
              {shownYear}
            </ButtonGroupText>
            <Button
              variant="outline"
              size="icon"
              aria-label="Neste år"
              onClick={() => setShownYear(shownYear + 1)}
            >
              <ChevronRightIcon />
            </Button>
          </ButtonGroup>
          <Popover
            open={popoverView !== "closed"}
            onOpenChange={(open) => setPopoverView(open ? "menu" : "closed")}
          >
            <PopoverTrigger
              render={
                <Button
                  variant={period.kind === "month" ? "outline" : "default"}
                >
                  {getTriggerLabel(period)}
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              }
            />
            {popoverView === "calendar" ? (
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={
                    period.kind === "custom" ? selectedRange : undefined
                  }
                  defaultMonth={selectedRange.from}
                  numberOfMonths={2}
                  onSelect={(next) => {
                    if (!next?.from) {
                      return;
                    }
                    const startDate = toDateInputValue(next.from);
                    const endDate = next.to
                      ? toDateInputValue(next.to)
                      : startDate;
                    onSelect({ kind: "custom", startDate, endDate });
                    // A first click yields a one-day range, so only a second, different day completes it.
                    if (startDate !== endDate) {
                      setPopoverView("closed");
                    }
                  }}
                />
              </PopoverContent>
            ) : (
              <PopoverContent className="w-52 gap-0 p-1" align="end">
                {ROLLING_ORDER.map((preset) => (
                  <Button
                    key={preset}
                    variant="ghost"
                    className="w-full justify-start"
                    aria-pressed={
                      period.kind === "rolling" && period.preset === preset
                    }
                    onClick={() => {
                      onSelect({ kind: "rolling", preset });
                      setPopoverView("closed");
                    }}
                  >
                    {ROLLING_LABELS[preset]}
                    {period.kind === "rolling" && period.preset === preset ? (
                      <CheckIcon className="ml-auto" />
                    ) : null}
                  </Button>
                ))}
                <Separator className="my-1" />
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  aria-pressed={period.kind === "custom"}
                  onClick={() => setPopoverView("calendar")}
                >
                  Egendefinert…
                  {period.kind === "custom" ? (
                    <CheckIcon className="ml-auto" />
                  ) : null}
                </Button>
              </PopoverContent>
            )}
          </Popover>
        </div>
      </div>
      <div
        role="group"
        aria-labelledby="dashboard-period-label"
        className="grid grid-cols-6 gap-1 lg:grid-cols-12"
      >
        {MONTHS.map((name, index) => {
          const month = index + 1;
          const isSelected =
            period.kind === "month" &&
            period.year === shownYear &&
            period.month === month;
          const isCurrent = shownYear === currentYear && month === currentMonth;
          const isFuture =
            shownYear > currentYear ||
            (shownYear === currentYear && month > currentMonth);

          return (
            <Button
              key={name.short}
              variant={isSelected ? "default" : "outline"}
              aria-label={`${name.long} ${shownYear}`}
              aria-pressed={isSelected}
              aria-current={isCurrent ? "date" : undefined}
              className={cn(
                "relative capitalize",
                isFuture &&
                  !isSelected &&
                  "border-dashed text-muted-foreground",
              )}
              onClick={() =>
                onSelect({ kind: "month", year: shownYear, month })
              }
            >
              {name.short}
              {isCurrent ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full",
                    isSelected ? "bg-primary-foreground" : "bg-foreground",
                  )}
                />
              ) : null}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

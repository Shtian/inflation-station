"use client";

import { ArrowRight, Calendar } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toDeltaDirection } from "@/lib/monthly-review/delta";
import { cn } from "@/lib/utils";
import { CategorySpendBar } from "./components/category-spend-bar";
import type { MonthlyReviewTimelineRow } from "./monthly-review-manager.types";
import {
  formatMonthHeading,
  formatMonthStartLabel,
  formatNok,
  formatSignedNok,
} from "./monthly-review-manager.utils";

const timelineResponseSchema = z.object({
  rows: z.array(z.unknown()),
});

const deltaPercentFormatter = new Intl.NumberFormat("nb-NO", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

function getReviewStateTone(
  reviewState: MonthlyReviewTimelineRow["reviewState"],
): {
  dotClassName: string;
  label: string;
} {
  if (reviewState === "GENERATED") {
    return {
      dotClassName: "border-success/60 text-success",
      label: "Oppsummering klar",
    };
  }

  if (reviewState === "GENERATING") {
    return {
      dotClassName: "border-warning/60 text-warning",
      label: "Skriver oppsummering…",
    };
  }

  if (reviewState === "FAILED") {
    return {
      dotClassName: "border-destructive/60 text-destructive",
      label: "Oppsummering feilet",
    };
  }

  return {
    dotClassName: "border-border text-muted-foreground",
    label: "Ingen oppsummering ennå",
  };
}

function formatDeltaPercent(row: MonthlyReviewTimelineRow): string | null {
  if (row.monthOverMonthSpendDeltaNok === null) {
    return null;
  }

  const previousSpend = row.totalSpendNok - row.monthOverMonthSpendDeltaNok;
  if (previousSpend <= 0) {
    return null;
  }

  return deltaPercentFormatter.format(
    row.monthOverMonthSpendDeltaNok / previousSpend,
  );
}

function describeSpendChange(row: MonthlyReviewTimelineRow): string {
  const delta = row.monthOverMonthSpendDeltaNok;
  if (delta === null) {
    return "Ingen forbruksdata for forrige måned";
  }

  const direction = toDeltaDirection(delta);
  if (direction === "flat") {
    return "Samme forbruk som forrige måned";
  }

  const percent = formatDeltaPercent(row);
  return `Forbruk ${direction === "up" ? "opp" : "ned"} ${formatNok(Math.abs(delta))}${percent ? ` (${percent})` : ""}`;
}

export function MonthlyReviewManager() {
  const [rows, setRows] = useState<MonthlyReviewTimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/monthly-review/timeline");
    const rawBody: unknown = await response.json().catch(() => null);
    const parsed = timelineResponseSchema.safeParse(rawBody);

    if (!response.ok || !parsed.success) {
      setRows([]);
      setError("Kunne ikke laste inn tidslinjen for månedsoppsummering.");
      setLoading(false);
      return;
    }

    const rows = parsed.data.rows as MonthlyReviewTimelineRow[];
    const sorted = [...rows].sort((a, b) =>
      b.monthStart.localeCompare(a.monthStart),
    );
    setRows(sorted);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const averageSpendNok = useMemo(() => {
    if (rows.length === 0) {
      return 0;
    }

    const totalSpend = rows.reduce((sum, row) => sum + row.totalSpendNok, 0);
    return totalSpend / rows.length;
  }, [rows]);

  const latestTrendRow = rows.find(
    (row) => row.monthOverMonthSpendDeltaNok !== null,
  );

  const trendDelta = latestTrendRow?.monthOverMonthSpendDeltaNok ?? null;
  const trendDirection =
    trendDelta === null ? null : toDeltaDirection(trendDelta);
  const trendColor =
    trendDirection === "up"
      ? "text-destructive"
      : trendDirection === "down"
        ? "text-success"
        : "";
  const trendPercent = latestTrendRow
    ? formatDeltaPercent(latestTrendRow)
    : null;

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight md:text-3xl">
          Økonomisk tidslinje
        </h1>
        <p className="text-muted-foreground text-sm">
          Månedlig oversikt over forbruket. Åpne en måned for å se måneden som
          gikk.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Snittforbruk per måned</CardDescription>
            <CardTitle className="text-2xl">
              {formatNok(averageSpendNok)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trend</CardDescription>
            <CardTitle className={`text-2xl ${trendColor}`}>
              {trendDelta === null
                ? "Ingen endringsdata"
                : trendDirection === "flat"
                  ? "Stabilt"
                  : formatSignedNok(trendDelta)}
            </CardTitle>
            <CardDescription>
              {trendDelta === null
                ? "Venter på minst 2 måneder med data"
                : trendDirection === "flat"
                  ? "Samme forbruk som måneden før"
                  : `${trendPercent ?? "Forbruk"} mot forrige måned`}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Separator className="my-4" />

      {loading ? (
        <output className="block text-muted-foreground text-sm">
          Laster inn tidslinjen…
        </output>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {error}
        </p>
      ) : null}

      {!loading && !error && !hasRows ? (
        <p className="text-muted-foreground text-sm">
          Ingen månedsdata er tilgjengelig ennå.
        </p>
      ) : null}

      <div className="relative space-y-6">
        {!loading && !error && hasRows ? (
          <div className="absolute top-1 bottom-0 left-5 hidden w-px bg-border md:block" />
        ) : null}

        {rows.map((row) => {
          const stateTone = getReviewStateTone(row.reviewState);

          return (
            <article key={row.monthStart} className="relative md:pl-14">
              <div
                className={`absolute top-2 left-0 z-10 hidden h-10 w-10 items-center justify-center rounded-full border bg-background text-sm md:flex ${stateTone.dotClassName}`}
                aria-hidden
              >
                <Calendar className="size-4" aria-hidden />
              </div>

              <div className="space-y-4 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-foreground text-xl">
                        {formatMonthHeading(row.monthStart)}
                      </h2>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${stateTone.dotClassName}`}
                      >
                        {stateTone.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {row.transactionCount}{" "}
                      {row.transactionCount === 1
                        ? "forbrukstransaksjon"
                        : "forbrukstransaksjoner"}
                    </p>
                  </div>

                  <div className="space-y-1 text-right">
                    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Månedens saldo
                    </p>
                    <p
                      className={`font-semibold text-2xl tracking-tight ${row.monthlyBalanceNok >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {formatSignedNok(row.monthlyBalanceNok, "auto")}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {describeSpendChange(row)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3 text-sm md:grid-cols-2">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Samlet forbruk
                    </p>
                    <p className="font-medium text-destructive">
                      {formatSignedNok(row.totalSpendNok, "negative")}
                    </p>
                  </div>
                  <div className="space-y-0.5 md:text-right">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Samlet inntekt
                    </p>
                    <p className="font-medium text-success">
                      {formatSignedNok(row.totalIncomeNok, "positive")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
                    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Forbruk per kategori
                    </p>
                    <CategorySpendBar
                      categories={row.categorySpendBreakdown}
                      total={row.totalSpendNok}
                    />
                  </div>

                  <Link
                    href={`/monthly-review/${row.monthStart}`}
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "h-11 bg-brand px-5 font-semibold text-base text-brand-foreground hover:bg-brand/90",
                    )}
                  >
                    Månedsrapport for {formatMonthStartLabel(row.monthStart)}
                    <ArrowRight aria-hidden />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { Calendar, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CategorySpendBar } from "./components/category-spend-bar";
import type { MonthlyReviewTimelineRow } from "./monthly-review-manager.types";
import {
  formatMonthStartLabel,
  formatNok,
  formatSignedNok,
} from "./monthly-review-manager.utils";

type TimelineResponse = {
  rows: MonthlyReviewTimelineRow[];
};

type GenerateMode = "generate" | "regenerate";

type GenerateDialogState = {
  monthStart: string;
  mode: GenerateMode;
};

function getReviewStateTone(
  reviewState: MonthlyReviewTimelineRow["reviewState"],
): {
  dotClassName: string;
  label: string;
} {
  if (reviewState === "GENERATED") {
    return {
      dotClassName:
        "border-emerald-500/60 text-emerald-600 dark:text-emerald-400",
      label: "Generated",
    };
  }

  if (reviewState === "GENERATING") {
    return {
      dotClassName: "border-amber-500/60 text-amber-600 dark:text-amber-400",
      label: "Generating",
    };
  }

  if (reviewState === "FAILED") {
    return {
      dotClassName: "border-destructive/60 text-destructive",
      label: "Failed",
    };
  }

  return {
    dotClassName: "border-border text-muted-foreground",
    label: "Not generated",
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

  const percent = (row.monthOverMonthSpendDeltaNok / previousSpend) * 100;
  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

function isTimelineResponse(value: unknown): value is TimelineResponse {
  if (!value || typeof value !== "object" || !("rows" in value)) {
    return false;
  }

  return Array.isArray((value as { rows: unknown }).rows);
}

export function MonthlyReviewManager() {
  const [rows, setRows] = useState<MonthlyReviewTimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generateDialogState, setGenerateDialogState] =
    useState<GenerateDialogState | null>(null);
  const [generateSavingMonthStart, setGenerateSavingMonthStart] = useState<
    string | null
  >(null);
  const [pendingGenerationMonthStart, setPendingGenerationMonthStart] =
    useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/monthly-review/timeline");
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok || !isTimelineResponse(body)) {
      setRows([]);
      setError("Could not load monthly review timeline.");
      setLoading(false);
      return;
    }

    const sorted = [...body.rows].sort((a, b) =>
      b.monthStart.localeCompare(a.monthStart),
    );
    setRows(sorted);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const selectedMonthLabel = useMemo(() => {
    if (!generateDialogState) {
      return null;
    }

    return formatMonthStartLabel(generateDialogState.monthStart);
  }, [generateDialogState]);

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

  const generatedCount = rows.filter(
    (row) => row.reviewState === "GENERATED",
  ).length;

  async function handleConfirmGenerate() {
    if (!generateDialogState || generateSavingMonthStart) {
      return;
    }

    const monthStart = generateDialogState.monthStart;
    setGenerateError(null);
    setGenerateSavingMonthStart(monthStart);
    setPendingGenerationMonthStart(monthStart);
    setGenerateDialogState(null);
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.monthStart === monthStart
          ? {
              ...row,
              reviewState: "GENERATING",
              errorMessage: null,
              reviewText: null,
            }
          : row,
      ),
    );

    const response = await fetch("/api/monthly-review/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ monthStart }),
    });

    if (!response.ok) {
      setGenerateSavingMonthStart(null);
      setPendingGenerationMonthStart(null);
      setGenerateError(
        "Could not start monthly review generation. Please try again.",
      );
      await loadTimeline();
      return;
    }

    setGenerateSavingMonthStart(null);
    await loadTimeline();
    setPendingGenerationMonthStart(null);
  }

  function openGenerateDialog(monthStart: string, mode: GenerateMode) {
    setGenerateError(null);
    setGenerateDialogState({ monthStart, mode });
  }

  function closeGenerateDialog() {
    if (generateSavingMonthStart) {
      return;
    }

    setGenerateDialogState(null);
    setGenerateError(null);
  }

  function handleGenerateDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      return;
    }

    closeGenerateDialog();
  }

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Financial Timeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Monthly spending overview with deterministic insights and optional
            AI reviews.
          </p>
        </div>
        <Button type="button" variant="outline" size="icon" asChild>
          <Link
            href="/monthly-review/settings"
            aria-label="Open monthly review settings"
          >
            <Settings aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. monthly spend</CardDescription>
            <CardTitle className="text-2xl">
              {formatNok(averageSpendNok)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trending</CardDescription>
            <CardTitle className="text-2xl">
              {latestTrendRow
                ? formatNok(latestTrendRow.monthOverMonthSpendDeltaNok ?? 0)
                : "No change data"}
            </CardTitle>
            <CardDescription>
              {latestTrendRow && formatDeltaPercent(latestTrendRow)
                ? `${formatDeltaPercent(latestTrendRow)} vs previous month`
                : "Waiting for at least two month entries"}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>AI review coverage</CardDescription>
            <CardTitle className="text-2xl">
              {generatedCount} of {rows.length} months
            </CardTitle>
            <CardDescription>Generated monthly review entries</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        Transfer-category transactions are excluded from spend and income
        analytics.
      </p>

      <Separator className="my-4" />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading timeline...</p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {!error && generateError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {generateError}
        </p>
      ) : null}

      {!loading && !error && !hasRows ? (
        <p className="text-sm text-muted-foreground">
          No monthly data is available yet.
        </p>
      ) : null}

      <div className="relative space-y-6">
        {!loading && !error && hasRows ? (
          <div className="absolute bottom-0 left-5 top-1 hidden w-px bg-border md:block" />
        ) : null}

        {rows.map((row) => {
          const stateTone = getReviewStateTone(row.reviewState);
          const deltaPercent = formatDeltaPercent(row);
          const isReviewGenerating =
            row.reviewState === "GENERATING" ||
            pendingGenerationMonthStart === row.monthStart;

          return (
            <article key={row.monthStart} className="relative md:pl-14">
              <div
                className={`absolute left-0 top-2 z-10 hidden h-10 w-10 items-center justify-center rounded-full border bg-background text-sm md:flex ${stateTone.dotClassName}`}
                aria-hidden
              >
                <Calendar className="size-4" aria-hidden />
              </div>

              <div className="space-y-4 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-foreground">
                        {formatMonthStartLabel(row.monthStart)}
                      </h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {row.transactionCount} spending transaction
                      {row.transactionCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="space-y-1 text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Monthly balance
                    </p>
                    <p className="text-3xl font-semibold tracking-tight text-foreground">
                      {formatSignedNok(row.monthlyBalanceNok, "auto")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.monthOverMonthSpendDeltaNok === null
                        ? "No previous-month spend data"
                        : `${row.monthOverMonthSpendDeltaNok > 0 ? "Spend up" : "Spend down"} ${formatNok(Math.abs(row.monthOverMonthSpendDeltaNok))}${deltaPercent ? ` (${deltaPercent})` : ""}`}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3 text-sm md:grid-cols-2">
                  <div className="space-y-0.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total spend
                    </p>
                    <p className="font-medium text-foreground">
                      {formatSignedNok(row.totalSpendNok, "negative")}
                    </p>
                  </div>
                  <div className="space-y-0.5 md:text-right">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total income
                    </p>
                    <p className="font-medium text-foreground">
                      {formatSignedNok(row.totalIncomeNok, "positive")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Category spend
                    </p>
                    <CategorySpendBar
                      categories={row.categorySpendBreakdown}
                      total={row.totalSpendNok}
                    />
                  </div>

                  {row.reviewState === "NOT_GENERATED" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        openGenerateDialog(row.monthStart, "generate")
                      }
                      disabled={generateSavingMonthStart !== null}
                    >
                      <Sparkles className="size-4" aria-hidden />
                      Get AI review
                    </Button>
                  ) : null}

                  {isReviewGenerating ? (
                    <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        AI insight
                      </p>
                      <p className="text-sm text-muted-foreground">
                        AI insight is generating...
                      </p>
                      <div className="space-y-2 pt-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-11/12" />
                        <Skeleton className="h-4 w-10/12" />
                        <Skeleton className="h-4 w-3/4 mb-4" />

                        <Skeleton className="h-4 w-11/12" />
                        <Skeleton className="h-4 w-10/12" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4 mb-4" />

                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-11/12" />
                        <Skeleton className="h-4 w-10/12" />
                      </div>
                    </div>
                  ) : null}

                  {row.reviewState === "FAILED" ? (
                    <div className="space-y-3">
                      <p
                        role="alert"
                        className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      >
                        {row.errorMessage
                          ? `Generation failed: ${row.errorMessage}`
                          : "Generation failed. Try regenerate review to retry."}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          openGenerateDialog(row.monthStart, "regenerate")
                        }
                        disabled={generateSavingMonthStart !== null}
                      >
                        Regenerate review
                      </Button>
                    </div>
                  ) : null}

                  {row.reviewState === "GENERATED" && row.reviewText ? (
                    <div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        AI insight
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {row.reviewText}
                      </p>

                      <div className="flex flex-wrap pt-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="link"
                          className="h-auto p-0 text-muted-foreground"
                          onClick={() =>
                            openGenerateDialog(row.monthStart, "regenerate")
                          }
                          disabled={generateSavingMonthStart !== null}
                        >
                          Regenerate insight
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <AlertDialog
        open={generateDialogState !== null}
        onOpenChange={handleGenerateDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {generateDialogState?.mode === "regenerate"
                ? "Regenerate monthly review?"
                : "Generate monthly review?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {generateDialogState?.mode === "regenerate"
                ? `This will replace the existing review text for ${selectedMonthLabel}.`
                : `This will generate a monthly AI review for ${selectedMonthLabel}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {generateError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {generateError}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={closeGenerateDialog}
              disabled={generateSavingMonthStart !== null}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmGenerate}
              disabled={generateSavingMonthStart !== null}
            >
              {generateSavingMonthStart !== null
                ? "Sending..."
                : generateDialogState?.mode === "regenerate"
                  ? "Regenerate now"
                  : "Generate now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

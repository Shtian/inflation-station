"use client";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { MonthlyReviewTimelineRow } from "./monthly-review-manager.types";
import {
  formatGeneratedAt,
  formatMonthStartLabel,
  formatNok,
  getReviewStateLabel,
} from "./monthly-review-manager.utils";

type TimelineResponse = {
  rows: MonthlyReviewTimelineRow[];
};

type GenerateMode = "generate" | "regenerate";

type GenerateDialogState = {
  monthStart: string;
  mode: GenerateMode;
};

function getReviewPreview(reviewText: string, maxLength = 220): string {
  const normalized = reviewText.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function getBadgeVariant(reviewState: MonthlyReviewTimelineRow["reviewState"]) {
  if (reviewState === "GENERATED") {
    return "default";
  }

  if (reviewState === "GENERATING") {
    return "secondary";
  }

  if (reviewState === "FAILED") {
    return "destructive";
  }

  return "outline";
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
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [expandedReviewMonthStart, setExpandedReviewMonthStart] = useState<
    string | null
  >(null);

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

  async function handleConfirmGenerate() {
    if (!generateDialogState || generateSavingMonthStart) {
      return;
    }

    setGenerateError(null);
    setGenerateSavingMonthStart(generateDialogState.monthStart);

    const response = await fetch("/api/monthly-review/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ monthStart: generateDialogState.monthStart }),
    });

    if (!response.ok) {
      setGenerateSavingMonthStart(null);
      setGenerateError(
        "Could not start monthly review generation. Please try again.",
      );
      return;
    }

    setGenerateSavingMonthStart(null);
    setGenerateDialogState(null);
    await loadTimeline();
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

  function toggleExpandedReview(monthStart: string) {
    setExpandedReviewMonthStart((currentMonthStart) =>
      currentMonthStart === monthStart ? null : monthStart,
    );
  }

  function handleGenerateDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      return;
    }

    closeGenerateDialog();
  }

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Monthly Review
        </h1>
        <p className="text-sm text-muted-foreground">
          Browse deterministic monthly spend summaries and current review
          status.
        </p>
      </div>

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

      {!loading && !error && !hasRows ? (
        <p className="text-sm text-muted-foreground">
          No monthly data is available yet.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <article key={row.monthStart}>
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>
                      <h2 className="text-lg">
                        {formatMonthStartLabel(row.monthStart)}
                      </h2>
                    </CardTitle>
                    <CardDescription>{row.monthStart}</CardDescription>
                  </div>
                  <Badge variant={getBadgeVariant(row.reviewState)}>
                    {getReviewStateLabel(row.reviewState)}
                  </Badge>
                </div>
                <CardDescription>
                  Last updated: {formatGeneratedAt(row.generatedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Total spend</dt>
                    <dd className="font-medium text-foreground">
                      {formatNok(row.totalSpendNok)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Transactions</dt>
                    <dd className="font-medium text-foreground">
                      {row.transactionCount}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Top category</dt>
                    <dd className="font-medium text-foreground">
                      {row.topCategory
                        ? `${row.topCategory.categoryName} (${formatNok(row.topCategory.spendNok)})`
                        : "No spend categories"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">MoM spend delta</dt>
                    <dd className="font-medium text-foreground">
                      {row.monthOverMonthSpendDeltaNok === null
                        ? "Not available"
                        : formatNok(row.monthOverMonthSpendDeltaNok)}
                    </dd>
                  </div>
                </dl>

                {row.reviewState === "NOT_GENERATED" ? (
                  <p className="text-muted-foreground">
                    No review generated for this month yet.
                  </p>
                ) : null}

                {row.reviewState === "GENERATING" ? (
                  <p className="text-muted-foreground">
                    Review generation is in progress for this month.
                  </p>
                ) : null}

                {row.reviewState === "FAILED" ? (
                  <p
                    role="alert"
                    className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {row.errorMessage
                      ? `Generation failed: ${row.errorMessage}`
                      : "Generation failed. Try regenerate review to retry."}
                  </p>
                ) : null}

                {row.reviewState === "GENERATED" && row.reviewText ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Review preview
                    </p>
                    <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm text-foreground">
                      {getReviewPreview(row.reviewText)}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toggleExpandedReview(row.monthStart)}
                    >
                      {expandedReviewMonthStart === row.monthStart
                        ? "Hide full review"
                        : "View full review"}
                    </Button>

                    {expandedReviewMonthStart === row.monthStart ? (
                      <p className="whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                        {row.reviewText}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="pt-1">
                  {row.reviewState === "NOT_GENERATED" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        openGenerateDialog(row.monthStart, "generate")
                      }
                      disabled={generateSavingMonthStart !== null}
                    >
                      Generate review
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        openGenerateDialog(row.monthStart, "regenerate")
                      }
                      disabled={
                        generateSavingMonthStart !== null ||
                        row.reviewState === "GENERATING"
                      }
                    >
                      Regenerate review
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </article>
        ))}
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

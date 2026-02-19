"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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

  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/monthly-review/timeline");
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok || !isTimelineResponse(body)) {
        if (!cancelled) {
          setRows([]);
          setError("Could not load monthly review timeline.");
          setLoading(false);
        }

        return;
      }

      if (!cancelled) {
        const sorted = [...body.rows].sort((a, b) =>
          b.monthStart.localeCompare(a.monthStart),
        );
        setRows(sorted);
        setLoading(false);
      }
    }

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, []);

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
              </CardContent>
            </Card>
          </article>
        ))}
      </div>
    </div>
  );
}

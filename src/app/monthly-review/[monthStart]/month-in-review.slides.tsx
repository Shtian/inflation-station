import { RefreshCw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryColor } from "@/lib/category-color";
import { formatNok, formatSignedNok } from "@/lib/format-nok";
import type { MonthInReviewWithReview } from "@/lib/monthly-review/month-in-review";
import {
  formatGeneratedAt,
  formatMonthStartLabel,
} from "../monthly-review-manager.utils";

export type GenerateMode = "generate" | "regenerate";

export type SlideContext = {
  review: MonthInReviewWithReview;
  monthLabel: string;
  isGenerating: boolean;
  onRequestGenerate: (mode: GenerateMode) => void;
};

export type SlideDefinition = {
  id: string;
  title: string;
  toneClassName: string;
  isAvailable: (review: MonthInReviewWithReview) => boolean;
  render: (context: SlideContext) => ReactNode;
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

function formatBookingDate(isoDate: string): string {
  return dayFormatter.format(new Date(`${isoDate}T00:00:00.000Z`));
}

function signedTone(value: number): string {
  return value >= 0 ? "text-success" : "text-destructive";
}

function spendDeltaTone(deltaNok: number): string {
  if (deltaNok === 0) {
    return "text-muted-foreground";
  }

  return deltaNok > 0 ? "text-destructive" : "text-success";
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.2em]">
      {children}
    </p>
  );
}

function Headline({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-balance font-extrabold text-4xl text-foreground tracking-tighter md:text-6xl">
      {children}
    </h2>
  );
}

function Stat({
  label,
  value,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`font-bold text-2xl tabular-nums tracking-tight md:text-3xl ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}

function introHook(review: MonthInReviewWithReview): string {
  const { cashflow } = review;

  if (cashflow.incomeNok === 0 && cashflow.spendNok === 0) {
    return "A quiet month with no spending or income recorded.";
  }

  if (cashflow.netNok >= 0) {
    return `You kept ${formatNok(cashflow.netNok)} of what came in. Let's see where the rest went.`;
  }

  return `You spent ${formatNok(Math.abs(cashflow.netNok))} more than came in. Let's see where it went.`;
}

function netSentence(review: MonthInReviewWithReview): string {
  const { cashflow } = review;

  if (cashflow.savingsRate === null) {
    return "No income was recorded this month.";
  }

  if (cashflow.savingsRate >= 0) {
    return `You kept ${formatPercent(cashflow.savingsRate)} of your income.`;
  }

  return `Spending outpaced income by ${formatPercent(Math.abs(cashflow.savingsRate))}.`;
}

function IntroSlide({ review, monthLabel }: SlideContext) {
  return (
    <div className="space-y-6">
      <Eyebrow>Month in review</Eyebrow>
      <Headline>{monthLabel}</Headline>
      <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
        <span className="font-semibold text-foreground tabular-nums">
          {review.spendTransactionCount} purchase
          {review.spendTransactionCount === 1 ? "" : "s"}
        </span>
        . {introHook(review)}
      </p>
    </div>
  );
}

function NetSlide({ review }: SlideContext) {
  const { cashflow, previousMonth, incomeSources } = review;
  const netChange = previousMonth
    ? cashflow.netNok - previousMonth.netNok
    : null;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Eyebrow>Net result</Eyebrow>
        <Headline>
          <span
            className={`tabular-nums ${signedTone(cashflow.netNok)}`}
            data-testid="net-result"
          >
            {formatSignedNok(cashflow.netNok, "auto")}
          </span>
        </Headline>
        <p className="text-lg text-muted-foreground">{netSentence(review)}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Stat
          label="Income in"
          value={formatSignedNok(cashflow.incomeNok, "positive")}
          valueClassName="text-success"
        />
        <Stat
          label="Spend out"
          value={formatSignedNok(cashflow.spendNok, "negative")}
          valueClassName="text-destructive"
        />
        <Stat
          label={
            previousMonth
              ? `vs ${formatMonthStartLabel(previousMonth.monthStart)}`
              : "vs previous month"
          }
          value={netChange === null ? "No data" : formatSignedNok(netChange)}
          valueClassName={
            netChange === null ? "text-muted-foreground" : signedTone(netChange)
          }
        />
      </div>

      {incomeSources.length > 0 ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Top income sources
          </p>
          <ul className="space-y-1">
            {incomeSources.map((source) => (
              <li
                key={source.source}
                className="flex items-baseline justify-between gap-4 border-border/60 border-b py-1.5 last:border-b-0"
              >
                <span className="truncate font-medium text-foreground">
                  {source.source}
                </span>
                <span className="text-success tabular-nums">
                  {formatSignedNok(source.amountNok, "positive")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CategoriesSlide({ review }: SlideContext) {
  const [top] = review.categories;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Eyebrow>Where it went</Eyebrow>
        <Headline>
          {top.categoryName} took {formatPercent(top.share)} of your spending.
        </Headline>
      </div>

      <ul className="space-y-4">
        {review.categories.map((category) => {
          const color = getCategoryColor(category.categoryName);

          return (
            <li
              key={category.categoryId ?? category.categoryName}
              className="space-y-1.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-semibold text-foreground">
                  {category.categoryName}
                </span>
                <span className="flex items-baseline gap-3 text-sm tabular-nums">
                  <span className="font-medium text-foreground">
                    {formatNok(category.spendNok)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatPercent(category.share)}
                  </span>
                  {category.deltaNok !== null ? (
                    <span className={spendDeltaTone(category.deltaNok)}>
                      {category.deltaNok === 0
                        ? "Same as last month"
                        : `${formatSignedNok(category.deltaNok)} vs last month`}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(category.share * 100, 1)}%`,
                    backgroundColor: color.backgroundColor,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MerchantsSlide({ review }: SlideContext) {
  const [top] = review.topMerchants;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Eyebrow>Top merchants</Eyebrow>
        <Headline>{top.merchant} was your top spot.</Headline>
      </div>

      <ol className="space-y-3">
        {review.topMerchants.map((merchant, index) => (
          <li
            key={merchant.merchant}
            className="flex items-center gap-4 border-border/60 border-b pb-3 last:border-b-0"
          >
            <span
              className="w-10 font-extrabold text-3xl text-muted-foreground/60 tabular-nums tracking-tighter"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground text-lg">
                {merchant.merchant}
              </p>
              <p className="text-muted-foreground text-sm">
                {merchant.transactionCount} purchase
                {merchant.transactionCount === 1 ? "" : "s"} ·{" "}
                {formatPercent(merchant.share)} of spend
              </p>
            </div>
            <span className="font-semibold text-foreground tabular-nums">
              {formatNok(merchant.spendNok)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MomentsSlide({ review }: SlideContext) {
  const { biggestPurchase, busiestDay } = review;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Eyebrow>Moments</Eyebrow>
        <Headline>The moments that stood out.</Headline>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {biggestPurchase ? (
          <div className="space-y-2 rounded-2xl bg-background/70 p-5">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Biggest purchase
            </p>
            <p className="font-extrabold text-3xl text-destructive tabular-nums tracking-tight">
              {formatNok(biggestPurchase.amountNok)}
            </p>
            <p className="font-semibold text-foreground">
              {biggestPurchase.merchant}
            </p>
            <p className="text-muted-foreground text-sm">
              {formatBookingDate(biggestPurchase.bookingDate)}
              {biggestPurchase.categoryName
                ? ` · ${biggestPurchase.categoryName}`
                : ""}
            </p>
          </div>
        ) : null}

        {busiestDay ? (
          <div className="space-y-2 rounded-2xl bg-background/70 p-5">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Busiest day
            </p>
            <p className="font-extrabold text-3xl text-foreground tracking-tight">
              {formatBookingDate(busiestDay.bookingDate)}
            </p>
            <p className="text-muted-foreground text-sm tabular-nums">
              {busiestDay.transactionCount} purchase
              {busiestDay.transactionCount === 1 ? "" : "s"} ·{" "}
              {formatNok(busiestDay.spendNok)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AiRecapSlide({
  review,
  isGenerating,
  onRequestGenerate,
}: SlideContext) {
  const generating = isGenerating || review.reviewState === "GENERATING";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Eyebrow>AI recap</Eyebrow>
        <Headline>In a nutshell.</Headline>
      </div>

      {generating ? (
        <div className="space-y-3">
          <output className="block text-muted-foreground">
            Writing your recap...
          </output>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="mb-4 h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ) : null}

      {!generating && review.reviewState === "FAILED" ? (
        <div className="space-y-4">
          <p
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          >
            {review.errorMessage
              ? `Generation failed: ${review.errorMessage}`
              : "Generation failed. Try regenerating the review."}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onRequestGenerate("regenerate")}
          >
            <RefreshCw aria-hidden />
            Regenerate review
          </Button>
        </div>
      ) : null}

      {!generating && review.reviewState === "NOT_GENERATED" ? (
        <div className="space-y-4">
          <p className="max-w-xl text-lg text-muted-foreground">
            Get a short written recap of this month, based on the same numbers
            you just flipped through.
          </p>
          <Button type="button" onClick={() => onRequestGenerate("generate")}>
            <Sparkles aria-hidden />
            Generate review
          </Button>
        </div>
      ) : null}

      {!generating &&
      review.reviewState === "GENERATED" &&
      review.reviewText ? (
        <div className="space-y-4">
          <p className="max-w-2xl whitespace-pre-wrap text-foreground text-lg leading-relaxed">
            {review.reviewText}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
            <span>Generated {formatGeneratedAt(review.generatedAt)}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRequestGenerate("regenerate")}
            >
              <RefreshCw aria-hidden />
              Regenerate review
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummarySlide({ review, monthLabel }: SlideContext) {
  const { cashflow } = review;
  const [topCategory] = review.categories;
  const [topMerchant] = review.topMerchants;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Eyebrow>Summary</Eyebrow>
        <Headline>{monthLabel} at a glance.</Headline>
      </div>

      <div className="grid gap-6 rounded-2xl bg-background/70 p-6 sm:grid-cols-2 md:p-8">
        <Stat
          label="Net"
          value={formatSignedNok(cashflow.netNok, "auto")}
          valueClassName={signedTone(cashflow.netNok)}
        />
        <Stat
          label="Savings rate"
          value={
            cashflow.savingsRate === null
              ? "No income"
              : formatPercent(cashflow.savingsRate)
          }
        />
        <Stat
          label="Income in"
          value={formatSignedNok(cashflow.incomeNok, "positive")}
          valueClassName="text-success"
        />
        <Stat
          label="Spend out"
          value={formatSignedNok(cashflow.spendNok, "negative")}
          valueClassName="text-destructive"
        />
        {topCategory ? (
          <Stat label="Top category" value={topCategory.categoryName} />
        ) : null}
        {topMerchant ? (
          <Stat label="Top merchant" value={topMerchant.merchant} />
        ) : null}
        {review.biggestPurchase ? (
          <Stat
            label="Biggest purchase"
            value={formatNok(review.biggestPurchase.amountNok)}
          />
        ) : null}
        {review.busiestDay ? (
          <Stat
            label="Busiest day"
            value={formatBookingDate(review.busiestDay.bookingDate)}
          />
        ) : null}
      </div>
    </div>
  );
}

export const MONTH_IN_REVIEW_SLIDES: SlideDefinition[] = [
  {
    id: "intro",
    title: "Intro",
    toneClassName: "bg-brand/10",
    isAvailable: () => true,
    render: (context) => <IntroSlide {...context} />,
  },
  {
    id: "net",
    title: "Net result",
    toneClassName: "bg-muted/60",
    isAvailable: (review) =>
      review.cashflow.incomeNok > 0 || review.cashflow.spendNok > 0,
    render: (context) => <NetSlide {...context} />,
  },
  {
    id: "categories",
    title: "Where it went",
    toneClassName: "bg-chart-1/10",
    isAvailable: (review) => review.categories.length > 0,
    render: (context) => <CategoriesSlide {...context} />,
  },
  {
    id: "merchants",
    title: "Top merchants",
    toneClassName: "bg-chart-2/10",
    isAvailable: (review) => review.topMerchants.length > 0,
    render: (context) => <MerchantsSlide {...context} />,
  },
  {
    id: "moments",
    title: "Moments",
    toneClassName: "bg-chart-3/10",
    isAvailable: (review) =>
      review.biggestPurchase !== null || review.busiestDay !== null,
    render: (context) => <MomentsSlide {...context} />,
  },
  {
    id: "ai-recap",
    title: "AI recap",
    toneClassName: "bg-brand/10",
    isAvailable: () => true,
    render: (context) => <AiRecapSlide {...context} />,
  },
  {
    id: "summary",
    title: "Summary",
    toneClassName: "bg-muted/60",
    isAvailable: () => true,
    render: (context) => <SummarySlide {...context} />,
  },
];

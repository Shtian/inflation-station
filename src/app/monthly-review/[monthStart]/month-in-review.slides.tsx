import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { formatNok, formatSignedNok } from "@/lib/format-nok";
import { toDeltaDirection } from "@/lib/monthly-review/delta";
import type { MonthInReviewWithReview } from "@/lib/monthly-review/month-in-review";
import { formatMonthStartLabel } from "../monthly-review-manager.utils";
import {
  firstSentence,
  formatDayLong,
  formatMonthName,
  formatPercent,
  keepAmountsTogether,
  toMonthDateRange,
} from "./month-in-review.format";
import { DECK_WORLDS, type DeckWorld } from "./month-in-review.worlds";

export type GenerateMode = "generate" | "regenerate";

export type SlideContext = {
  review: MonthInReviewWithReview;
  monthLabel: string;
  isGenerating: boolean;
  generateFailed: boolean;
  onRequestGenerate: (mode: GenerateMode) => void;
  onReplay: () => void;
};

export type SlideDefinition = {
  id: string;
  title: string;
  world: (review: MonthInReviewWithReview) => DeckWorld;
  isAvailable: (review: MonthInReviewWithReview) => boolean;
  render: (context: SlideContext) => ReactNode;
};

const VISIBLE_CATEGORY_LIMIT = 6;
const VISIBLE_BILL_LIMIT = 6;
const COUNT_UP_MS = 900;

function whole(value: number): string {
  return formatNok(value, { whole: true });
}

function plural(count: number, noun: string): string {
  return `${count}\u00a0${noun}${count === 1 ? "" : "s"}`;
}

function signedNet(netNok: number): string {
  return toDeltaDirection(netNok) === "flat"
    ? whole(0)
    : formatSignedNok(netNok, "auto", { whole: true });
}

function hasActivity(review: MonthInReviewWithReview): boolean {
  return review.cashflow.incomeNok > 0 || review.cashflow.spendNok > 0;
}

function recapText(review: MonthInReviewWithReview): string | null {
  return review.reviewState === "GENERATED" && review.reviewText?.trim()
    ? review.reviewText.trim()
    : null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useCountUp(target: number): number {
  const [value, setValue] = useState(() =>
    typeof window === "undefined" || prefersReducedMotion() ? target : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
      setValue(target * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

function Headline({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-balance font-extrabold text-[clamp(2rem,7vw,4rem)] text-[var(--mir-accent)] leading-[1.02] tracking-[-0.025em] ${className}`}
    >
      {children}
    </h2>
  );
}

function Muted({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[var(--mir-muted)] text-base md:text-lg ${className}`}>
      {children}
    </p>
  );
}

function introLine(review: MonthInReviewWithReview): string {
  const recap = recapText(review);
  if (recap) {
    return keepAmountsTogether(firstSentence(recap));
  }

  const { cashflow } = review;
  if (!hasActivity(review)) {
    return "A quiet month with no spending or income recorded.";
  }

  if (cashflow.netNok >= 0) {
    return `You kept ${whole(cashflow.netNok)} of what came in. Let's see where the rest went.`;
  }

  return `You spent ${whole(Math.abs(cashflow.netNok))} more than came in. Let's see where it went.`;
}

function IntroSlide({ review }: SlideContext) {
  const [monthName, year] = formatMonthStartLabel(review.monthStart).split(" ");

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <h2 className="mir-wipe-up font-black text-[var(--mir-accent)] leading-[0.92] tracking-[-0.02em]">
        <span className="mir-expanded block text-[clamp(2.75rem,11.5vw,6rem)]">
          {monthName}
        </span>
        <span className="mir-condensed block text-[clamp(2.75rem,11.5vw,6rem)]">
          {year}
        </span>
      </h2>
      <p className="max-w-[38ch] text-pretty text-xl leading-snug md:text-3xl">
        {introLine(review)}
      </p>
    </div>
  );
}

function savingsSentence(review: MonthInReviewWithReview): string {
  const { savingsRate } = review.cashflow;

  if (savingsRate === null) {
    return "No income was recorded this month.";
  }

  if (savingsRate >= 0) {
    return `You kept ${formatPercent(savingsRate)} of your income.`;
  }

  return `Spending outpaced income by ${formatPercent(Math.abs(savingsRate))}.`;
}

function netChangeSentence(review: MonthInReviewWithReview): string | null {
  const { previousMonth, cashflow } = review;
  if (!previousMonth) {
    return null;
  }

  const month = formatMonthName(previousMonth.monthStart);
  const change = cashflow.netNok - previousMonth.netNok;
  const direction = toDeltaDirection(change);

  if (direction === "flat") {
    return `Same as ${month}.`;
  }

  return `${whole(Math.abs(change))} ${direction === "up" ? "better" : "worse"} than ${month}.`;
}

function FlowBar({
  label,
  amountNok,
  maxNok,
}: {
  label: string;
  amountNok: number;
  maxNok: number;
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1">
      <dt className="font-semibold text-[var(--mir-muted)] text-sm uppercase tracking-[0.08em]">
        {label}
      </dt>
      <dd className="font-bold text-lg md:text-xl">{whole(amountNok)}</dd>
      <div className="mir-track col-span-2 h-3 overflow-hidden rounded-full">
        <div
          className="mir-grow-x h-full rounded-full bg-[var(--mir-accent)]"
          style={{
            width: `${maxNok > 0 ? Math.max((amountNok / maxNok) * 100, 1) : 0}%`,
          }}
        />
      </div>
    </div>
  );
}

function NetSlide({ review }: SlideContext) {
  const { cashflow } = review;
  const shown = useCountUp(cashflow.netNok);
  const maxNok = Math.max(cashflow.incomeNok, cashflow.spendNok);
  const change = netChangeSentence(review);

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <div className="space-y-3">
        <h2 aria-label={`Net ${signedNet(cashflow.netNok)}`}>
          <span
            aria-hidden
            data-testid="net-result"
            className="mir-condensed block font-black text-[clamp(4.5rem,24vw,6rem)] text-[var(--mir-accent)] leading-[0.9] tracking-[-0.02em]"
          >
            {signedNet(Math.round(shown))}
          </span>
        </h2>
        <p className="text-pretty font-semibold text-xl md:text-2xl">
          {savingsSentence(review)}
        </p>
      </div>
      <dl className="grid max-w-2xl gap-5">
        <FlowBar label="In" amountNok={cashflow.incomeNok} maxNok={maxNok} />
        <FlowBar label="Out" amountNok={cashflow.spendNok} maxNok={maxNok} />
      </dl>
      {change ? <Muted>{change}</Muted> : null}
    </div>
  );
}

function categoryDeltaLabel(deltaNok: number): string | null {
  const direction = toDeltaDirection(deltaNok);
  if (direction === "flat") {
    return null;
  }

  return `${whole(Math.abs(deltaNok))} ${direction === "up" ? "more" : "less"}`;
}

function CategoriesSlide({ review }: SlideContext) {
  const [top] = review.categories;
  const visible = review.categories.slice(0, VISIBLE_CATEGORY_LIMIT);
  const rest = review.categories.slice(VISIBLE_CATEGORY_LIMIT);
  const restSpendNok = rest.reduce(
    (sum, category) => sum + category.spendNok,
    0,
  );
  const previousMonthName = review.previousMonth
    ? formatMonthName(review.previousMonth.monthStart)
    : null;
  const allFlat =
    previousMonthName !== null &&
    review.categories.every(
      (category) => toDeltaDirection(category.deltaNok ?? 0) === "flat",
    );
  const showRowDeltas = previousMonthName !== null && !allFlat;
  const { dateFrom, dateTo } = toMonthDateRange(review.monthStart);

  return (
    <div className="flex flex-col gap-7 md:gap-9">
      <Headline>
        {top.categoryName} took {formatPercent(top.share)} of your spending.
      </Headline>

      <ul className="grid gap-3.5 md:gap-4">
        {visible.map((category, index) => {
          const delta =
            showRowDeltas && category.deltaNok !== null
              ? categoryDeltaLabel(category.deltaNok)
              : null;
          const row = (
            <>
              <span className="flex items-baseline justify-between gap-4">
                <span className="truncate font-bold text-lg md:text-xl">
                  {category.categoryName}
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  {delta ? (
                    <span className="text-[var(--mir-muted)] text-sm">
                      {delta}
                    </span>
                  ) : null}
                  <span className="font-semibold">
                    {whole(category.spendNok)}
                  </span>
                </span>
              </span>
              <span className="mir-track mt-1.5 block h-2.5 overflow-hidden rounded-full">
                <span
                  className="mir-grow-x block h-full rounded-full bg-[var(--mir-accent)]"
                  style={{
                    width: `${Math.max((category.spendNok / top.spendNok) * 100, 1)}%`,
                    animationDelay: `${index * 70}ms`,
                  }}
                />
              </span>
            </>
          );

          return (
            <li key={category.categoryId ?? category.categoryName}>
              {category.categoryId ? (
                <Link
                  href={`/transactions?dateFrom=${dateFrom}&dateTo=${dateTo}&categoryId=${encodeURIComponent(category.categoryId)}`}
                  className="block rounded-sm no-underline decoration-[var(--mir-accent)] hover:[&_span.truncate]:underline"
                >
                  {row}
                </Link>
              ) : (
                <div>{row}</div>
              )}
            </li>
          );
        })}
      </ul>

      {rest.length > 0 || allFlat ? (
        <div className="space-y-1">
          {allFlat ? (
            <Muted>Every category held steady vs {previousMonthName}.</Muted>
          ) : null}
          {rest.length > 0 ? (
            <Muted>
              {rest.length} more {rest.length === 1 ? "category" : "categories"}{" "}
              shared the remaining {whole(restSpendNok)}.
            </Muted>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BillsSlide({ review }: SlideContext) {
  const { bills, cashflow } = review;
  const visible = bills.items.slice(0, VISIBLE_BILL_LIMIT);
  const rest = bills.items.slice(VISIBLE_BILL_LIMIT);
  const restNok = rest.reduce((sum, bill) => sum + bill.amountNok, 0);

  return (
    <div className="flex flex-col gap-7 md:gap-9">
      <div className="space-y-3">
        <Headline>Bills ran like clockwork: {whole(bills.totalNok)}.</Headline>
        <Muted>
          {plural(bills.count, "fixed payment")},{" "}
          {formatPercent(bills.totalNok / cashflow.spendNok)} of everything you
          spent.
        </Muted>
      </div>

      <ul className="grid max-w-3xl">
        {visible.map((bill, index) => (
          <li
            key={`${bill.merchant}-${index}`}
            className="mir-tick flex items-baseline justify-between gap-4 border-[color-mix(in_oklab,var(--mir-fg)_22%,transparent)] border-b py-2.5 last:border-b-0"
            style={{ animationDelay: `${index * 140}ms` }}
          >
            <span className="min-w-0">
              <span className="block truncate font-bold text-lg">
                {bill.merchant}
              </span>
              {bill.categoryName ? (
                <span className="block truncate text-[var(--mir-muted)] text-sm">
                  {bill.categoryName}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-semibold text-lg">
              {whole(bill.amountNok)}
            </span>
          </li>
        ))}
      </ul>
      {rest.length > 0 ? (
        <Muted>
          {plural(rest.length, "more bill")} came to {whole(restNok)}.
        </Muted>
      ) : null}
    </div>
  );
}

function MerchantsSlide({ review }: SlideContext) {
  const [first, ...others] = review.everyday.topMerchants;
  const runnersUp = others.slice(0, 2);
  const tail = others.slice(2);

  return (
    <div className="flex flex-col gap-7 md:gap-9">
      <h2 className="overflow-hidden pb-1">
        <span className="mir-rise block">
          <span className="mir-condensed block break-words font-black text-[clamp(3.5rem,17vw,6rem)] text-[var(--mir-accent)] leading-[0.92] tracking-[-0.02em]">
            {first.merchant}
          </span>
          <span className="mt-2 block font-bold text-2xl md:text-3xl">
            {whole(first.spendNok)},{" "}
            {plural(first.transactionCount, "purchase")}
          </span>
        </span>
      </h2>

      {runnersUp.length > 0 ? (
        <ol start={2} className="grid gap-5 sm:grid-cols-2">
          {runnersUp.map((merchant, index) => (
            <li key={merchant.merchant} className="overflow-hidden pb-1">
              <div
                className="mir-rise flex items-baseline gap-3"
                style={{ animationDelay: `${(index + 1) * 120}ms` }}
              >
                <span className="font-black text-2xl text-[var(--mir-muted)]">
                  {index + 2}
                </span>
                <span className="min-w-0">
                  <span className="mir-condensed block truncate font-extrabold text-[clamp(2rem,8vw,3rem)] leading-none">
                    {merchant.merchant}
                  </span>
                  <span className="block font-semibold text-lg">
                    {whole(merchant.spendNok)}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {tail.length > 0 ? (
        <ol
          start={4}
          className="flex flex-wrap gap-x-8 gap-y-2 text-[var(--mir-muted)]"
        >
          {tail.map((merchant, index) => (
            <li key={merchant.merchant} className="overflow-hidden">
              <span
                className="mir-rise block"
                style={{ animationDelay: `${(index + 3) * 120}ms` }}
              >
                <span className="font-black">{index + 4}</span>{" "}
                <span className="font-semibold text-[var(--mir-fg)]">
                  {merchant.merchant}
                </span>{" "}
                {whole(merchant.spendNok)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function MomentsSlide({ review }: SlideContext) {
  const { biggestPurchase, busiestDay, dailySpend } = review.everyday;
  const maxDayCount = Math.max(
    ...dailySpend.map((day) => day.transactionCount),
    1,
  );
  const [firstDay] = dailySpend;
  const lastDay = dailySpend.at(-1);

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      {biggestPurchase ? (
        <div className="space-y-3">
          <Headline>
            {biggestPurchase.merchant}, {whole(biggestPurchase.amountNok)},{" "}
            {formatDayLong(biggestPurchase.bookingDate)}
          </Headline>
          <Muted>
            Your biggest everyday purchase
            {biggestPurchase.categoryName
              ? `, in ${biggestPurchase.categoryName}`
              : ""}
            .
          </Muted>
        </div>
      ) : null}

      <figure className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3">
        <p className="col-start-2 text-[var(--mir-muted)] text-sm">
          Everyday purchases per day
        </p>
        <div
          className="flex h-36 flex-col justify-between text-right text-[var(--mir-muted)] text-sm tabular-nums leading-none md:h-44"
          aria-hidden="true"
        >
          <span>{maxDayCount}</span>
          <span>0</span>
        </div>
        <div
          className="mir-sweep flex h-36 items-end gap-[3px] md:h-44 md:gap-1"
          role="img"
          aria-label={`Everyday purchases per day${busiestDay ? `, most on ${formatDayLong(busiestDay.bookingDate)}` : ""}`}
        >
          {dailySpend.map((day) => {
            const isBusiest = day.date === busiestDay?.bookingDate;
            return (
              <div
                key={day.date}
                className={`min-h-[3px] flex-1 rounded-t-[3px] ${
                  isBusiest
                    ? "bg-[var(--mir-accent)]"
                    : "bg-[color-mix(in_oklab,var(--mir-accent)_32%,transparent)]"
                }`}
                style={{
                  height: `${(day.transactionCount / maxDayCount) * 100}%`,
                }}
              />
            );
          })}
        </div>
        <div className="col-start-2 flex justify-between text-[var(--mir-muted)] text-sm">
          <span>{firstDay ? Number(firstDay.date.slice(8)) : null}</span>
          <span>{lastDay ? Number(lastDay.date.slice(8)) : null}</span>
        </div>
        {busiestDay ? (
          <figcaption className="col-span-2 text-pretty font-semibold text-lg md:text-xl">
            Most purchases: {formatDayLong(busiestDay.bookingDate)},{" "}
            {plural(busiestDay.transactionCount, "purchase")} for{" "}
            {whole(busiestDay.spendNok)}.
          </figcaption>
        ) : null}
      </figure>
    </div>
  );
}

function TextButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="justify-self-start text-left font-semibold text-[var(--mir-accent)] underline decoration-2 underline-offset-[0.22em] hover:decoration-[3px]"
    >
      {children}
    </button>
  );
}

function RecapVoice({
  review,
  isGenerating,
  generateFailed,
  onRequestGenerate,
}: SlideContext) {
  const recap = recapText(review);

  if (isGenerating || review.reviewState === "GENERATING") {
    return (
      <output className="block text-[var(--mir-muted)] text-lg">
        Writing the recap…
      </output>
    );
  }

  if (generateFailed || review.reviewState === "FAILED") {
    return (
      <div role="alert" className="space-y-2 text-lg">
        <p>The recap couldn't be written. Try again.</p>
        <TextButton onClick={() => onRequestGenerate("regenerate")}>
          Retry
        </TextButton>
      </div>
    );
  }

  if (recap) {
    return (
      <div className="space-y-3">
        <p className="max-w-[60ch] whitespace-pre-line text-pretty text-lg leading-relaxed md:text-xl">
          {keepAmountsTogether(recap)}
        </p>
        <TextButton onClick={() => onRequestGenerate("regenerate")}>
          Rewrite the recap
        </TextButton>
      </div>
    );
  }

  if (!hasActivity(review)) {
    return null;
  }

  return (
    <TextButton onClick={() => onRequestGenerate("generate")}>
      Write a recap
    </TextButton>
  );
}

const exitLinkClassName =
  "inline-flex items-center gap-2 font-semibold underline decoration-2 underline-offset-[0.22em] hover:text-[var(--mir-accent)]";

function FinaleSlide(context: SlideContext) {
  const { review, onReplay } = context;
  const { cashflow, bills, everyday, adjacentMonths } = review;
  const [topCategory] = review.categories;
  const { dateFrom, dateTo } = toMonthDateRange(review.monthStart);

  return (
    <div className="flex flex-col gap-9 md:gap-12">
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
        <div className="space-y-4">
          <h2 aria-label={`Net ${signedNet(cashflow.netNok)}`}>
            <span
              aria-hidden
              className="mir-condensed block font-black text-[clamp(4rem,20vw,6rem)] text-[var(--mir-accent)] leading-[0.9] tracking-[-0.02em]"
            >
              {signedNet(cashflow.netNok)}
            </span>
          </h2>
          <ul className="space-y-1 text-lg">
            <li>
              {whole(cashflow.incomeNok)} in, {whole(cashflow.spendNok)} out.
            </li>
            {topCategory ? (
              <li>
                {topCategory.categoryName} led spending at{" "}
                {formatPercent(topCategory.share)}.
              </li>
            ) : null}
            {bills.count > 0 ? (
              <li>
                {whole(bills.totalNok)} in bills, {whole(everyday.totalNok)}{" "}
                everyday.
              </li>
            ) : null}
          </ul>
        </div>
        <RecapVoice {...context} />
      </div>

      <nav
        aria-label="Leave the review"
        className="flex flex-wrap items-center gap-x-7 gap-y-3"
      >
        {adjacentMonths.previous ? (
          <Link
            href={`/monthly-review/${adjacentMonths.previous}`}
            className={exitLinkClassName}
          >
            <ArrowLeft aria-hidden className="size-4" />
            {formatMonthStartLabel(adjacentMonths.previous)}
          </Link>
        ) : null}
        <button type="button" onClick={onReplay} className={exitLinkClassName}>
          Replay
        </button>
        <Link
          href={`/transactions?dateFrom=${dateFrom}&dateTo=${dateTo}`}
          className={exitLinkClassName}
        >
          See transactions
        </Link>
        {adjacentMonths.next ? (
          <Link
            href={`/monthly-review/${adjacentMonths.next}`}
            className={exitLinkClassName}
          >
            {formatMonthStartLabel(adjacentMonths.next)}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

export const MONTH_IN_REVIEW_SLIDES: SlideDefinition[] = [
  {
    id: "intro",
    title: "Intro",
    world: () => DECK_WORLDS.base,
    isAvailable: () => true,
    render: (context) => <IntroSlide {...context} />,
  },
  {
    id: "net",
    title: "Net result",
    world: (review) =>
      review.cashflow.netNok >= 0 ? DECK_WORLDS.positive : DECK_WORLDS.negative,
    isAvailable: hasActivity,
    render: (context) => <NetSlide {...context} />,
  },
  {
    id: "categories",
    title: "Where it went",
    world: () => DECK_WORLDS.brand,
    isAvailable: (review) => review.categories.length > 0,
    render: (context) => <CategoriesSlide {...context} />,
  },
  {
    id: "bills",
    title: "Bills",
    world: () => DECK_WORLDS.neutral,
    isAvailable: (review) => review.bills.count > 0,
    render: (context) => <BillsSlide {...context} />,
  },
  {
    id: "merchants",
    title: "Top merchants",
    world: () => DECK_WORLDS.brandSoft,
    isAvailable: (review) => review.everyday.topMerchants.length > 0,
    render: (context) => <MerchantsSlide {...context} />,
  },
  {
    id: "moments",
    title: "Moments",
    world: () => DECK_WORLDS.neutralDeep,
    isAvailable: (review) => review.everyday.count > 0,
    render: (context) => <MomentsSlide {...context} />,
  },
  {
    id: "finale",
    title: "Finale",
    world: () => DECK_WORLDS.base,
    isAvailable: () => true,
    render: (context) => <FinaleSlide {...context} />,
  },
];

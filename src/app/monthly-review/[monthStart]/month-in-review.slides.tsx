import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { formatNok, formatSignedNok } from "@/lib/format-nok";
import { toDeltaDirection } from "@/lib/monthly-review/delta";
import type { MonthInReviewWithReview } from "@/lib/monthly-review/month-in-review";
import type { MonthlyRecap } from "@/lib/monthly-review/recap";
import { formatMonthHeading } from "../monthly-review-manager.utils";
import {
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

function plural(count: number, one: string, many: string): string {
  return `${count}\u00a0${count === 1 ? one : many}`;
}

function signedNet(netNok: number): string {
  return toDeltaDirection(netNok) === "flat"
    ? whole(0)
    : formatSignedNok(netNok, "auto", { whole: true });
}

function hasActivity(review: MonthInReviewWithReview): boolean {
  return review.cashflow.incomeNok > 0 || review.cashflow.spendNok > 0;
}

function recap(review: MonthInReviewWithReview): MonthlyRecap | null {
  return review.reviewState === "GENERATED" ? review.recap : null;
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
      className={`text-[clamp(2rem,7vw,4rem)] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance text-[var(--mir-accent)] ${className}`}
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
    <p className={`text-base text-[var(--mir-muted)] md:text-lg ${className}`}>
      {children}
    </p>
  );
}

function introLine(review: MonthInReviewWithReview): string {
  const generated = recap(review);
  if (generated) {
    return keepAmountsTogether(generated.headline);
  }

  const { cashflow } = review;
  if (!hasActivity(review)) {
    return "En rolig måned uten registrert forbruk eller inntekt.";
  }

  if (cashflow.netNok >= 0) {
    return `Du beholdt ${whole(cashflow.netNok)} av det som kom inn. La oss se hvor resten ble av.`;
  }

  return `Du brukte ${whole(Math.abs(cashflow.netNok))} mer enn det som kom inn. La oss se hvor pengene ble av.`;
}

function IntroSlide({ review }: SlideContext) {
  const [monthName, year] = formatMonthHeading(review.monthStart).split(" ");

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <h2 className="mir-wipe-up leading-[0.92] font-black tracking-[-0.02em] text-[var(--mir-accent)]">
        <span className="mir-expanded block text-[clamp(2.75rem,11.5vw,6rem)]">
          {monthName}
        </span>
        <span className="mir-condensed block text-[clamp(2.75rem,11.5vw,6rem)]">
          {year}
        </span>
      </h2>
      <p className="max-w-[38ch] text-xl leading-snug text-pretty md:text-3xl">
        {introLine(review)}
      </p>
    </div>
  );
}

function savingsSentence(review: MonthInReviewWithReview): string {
  const { savingsRate } = review.cashflow;

  if (savingsRate === null) {
    return "Ingen inntekt ble registrert denne måneden.";
  }

  if (savingsRate >= 0) {
    return `Du beholdt ${formatPercent(savingsRate)} av inntekten din.`;
  }

  return `Forbruket var ${formatPercent(Math.abs(savingsRate))} høyere enn inntekten.`;
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
    return `Samme som i ${month}.`;
  }

  return `${whole(Math.abs(change))} ${direction === "up" ? "bedre" : "dårligere"} enn i ${month}.`;
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
      <dt className="text-sm font-semibold tracking-[0.08em] text-[var(--mir-muted)] uppercase">
        {label}
      </dt>
      <dd className="text-lg font-bold md:text-xl">{whole(amountNok)}</dd>
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
        <h2 aria-label={`Netto ${signedNet(cashflow.netNok)}`}>
          <span
            aria-hidden
            data-testid="net-result"
            className="mir-condensed block text-[clamp(4.5rem,24vw,6rem)] leading-[0.9] font-black tracking-[-0.02em] text-[var(--mir-accent)]"
          >
            {signedNet(Math.round(shown))}
          </span>
        </h2>
        <p className="text-xl font-semibold text-pretty md:text-2xl">
          {savingsSentence(review)}
        </p>
      </div>
      <dl className="grid max-w-2xl gap-5">
        <FlowBar label="Inn" amountNok={cashflow.incomeNok} maxNok={maxNok} />
        <FlowBar label="Ut" amountNok={cashflow.spendNok} maxNok={maxNok} />
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

  return `${whole(Math.abs(deltaNok))} ${direction === "up" ? "mer" : "mindre"}`;
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
        {top.categoryName} utgjorde {formatPercent(top.share)} av forbruket
        ditt.
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
                <span className="truncate text-lg font-bold md:text-xl">
                  {category.categoryName}
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  {delta ? (
                    <span className="text-sm text-[var(--mir-muted)]">
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
                  to="/transactions"
                  search={{
                    dateFrom,
                    dateTo,
                    categoryId: category.categoryId,
                  }}
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
            <Muted>
              Alle kategorier holdt seg på samme nivå som i {previousMonthName}.
            </Muted>
          ) : null}
          {rest.length > 0 ? (
            <Muted>
              {rest.length}{" "}
              {rest.length === 1 ? "annen kategori" : "andre kategorier"} sto
              for de resterende {whole(restSpendNok)}.
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
        <Headline>Regningene gikk som smurt: {whole(bills.totalNok)}.</Headline>
        <Muted>
          {plural(bills.count, "fast betaling", "faste betalinger")},{" "}
          {formatPercent(bills.totalNok / cashflow.spendNok)} av alt du brukte.
        </Muted>
      </div>

      <ul className="grid max-w-3xl">
        {visible.map((bill, index) => (
          <li
            key={`${bill.merchant}-${index}`}
            className="mir-tick flex items-baseline justify-between gap-4 border-b border-[color-mix(in_oklab,var(--mir-fg)_22%,transparent)] py-2.5 last:border-b-0"
            style={{ animationDelay: `${index * 140}ms` }}
          >
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold">
                {bill.merchant}
              </span>
              {bill.categoryName ? (
                <span className="block truncate text-sm text-[var(--mir-muted)]">
                  {bill.categoryName}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-lg font-semibold">
              {whole(bill.amountNok)}
            </span>
          </li>
        ))}
      </ul>
      {rest.length > 0 ? (
        <Muted>
          {plural(rest.length, "annen regning", "andre regninger")} utgjorde{" "}
          {whole(restNok)}.
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
          <span className="mir-condensed block text-[clamp(3.5rem,17vw,6rem)] leading-[0.92] font-black tracking-[-0.02em] break-words text-[var(--mir-accent)]">
            {first.merchant}
          </span>
          <span className="mt-2 block text-2xl font-bold md:text-3xl">
            {whole(first.spendNok)},{" "}
            {plural(first.transactionCount, "kjøp", "kjøp")}
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
                <span className="text-2xl font-black text-[var(--mir-muted)]">
                  {index + 2}
                </span>
                <span className="min-w-0">
                  <span className="mir-condensed block truncate text-[clamp(2rem,8vw,3rem)] leading-none font-extrabold">
                    {merchant.merchant}
                  </span>
                  <span className="block text-lg font-semibold">
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
            Ditt største hverdagskjøp
            {biggestPurchase.categoryName
              ? `, i ${biggestPurchase.categoryName}`
              : ""}
            .
          </Muted>
        </div>
      ) : null}

      <figure className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3">
        <p className="col-start-2 text-sm text-[var(--mir-muted)]">
          Hverdagskjøp per dag
        </p>
        <div
          className="flex h-36 flex-col justify-between text-right text-sm leading-none text-[var(--mir-muted)] tabular-nums md:h-44"
          aria-hidden="true"
        >
          <span>{maxDayCount}</span>
          <span>0</span>
        </div>
        <div
          className="mir-sweep flex h-36 items-end gap-[3px] md:h-44 md:gap-1"
          role="img"
          aria-label={`Hverdagskjøp per dag${busiestDay ? `, flest ${formatDayLong(busiestDay.bookingDate)}` : ""}`}
        >
          {dailySpend.map((day) => {
            const isBusiest =
              day.transactionCount === busiestDay?.transactionCount;
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
        <div className="col-start-2 flex justify-between text-sm text-[var(--mir-muted)]">
          <span>{firstDay ? Number(firstDay.date.slice(8)) : null}</span>
          <span>{lastDay ? Number(lastDay.date.slice(8)) : null}</span>
        </div>
        {busiestDay ? (
          <figcaption className="col-span-2 text-lg font-semibold text-pretty md:text-xl">
            Flest kjøp: {formatDayLong(busiestDay.bookingDate)},{" "}
            {plural(busiestDay.transactionCount, "kjøp", "kjøp")} for{" "}
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
  const generated = recap(review);

  if (isGenerating || review.reviewState === "GENERATING") {
    return (
      <output className="block text-lg text-[var(--mir-muted)]">
        Skriver oppsummeringen…
      </output>
    );
  }

  if (generateFailed || review.reviewState === "FAILED") {
    return (
      <div role="alert" className="space-y-2 text-lg">
        <p>Oppsummeringen kunne ikke skrives. Prøv igjen.</p>
        <TextButton onClick={() => onRequestGenerate("regenerate")}>
          Prøv igjen
        </TextButton>
      </div>
    );
  }

  if (generated) {
    return (
      <div className="max-w-[60ch] space-y-3">
        <p className="text-xl font-semibold text-pretty md:text-2xl">
          {keepAmountsTogether(generated.headline)}
        </p>
        <ul className="space-y-2 text-lg leading-relaxed text-pretty">
          {generated.points.map((point) => (
            <li key={point}>{keepAmountsTogether(point)}</li>
          ))}
        </ul>
        <TextButton onClick={() => onRequestGenerate("regenerate")}>
          Skriv oppsummeringen på nytt
        </TextButton>
      </div>
    );
  }

  if (!hasActivity(review)) {
    return null;
  }

  return (
    <TextButton onClick={() => onRequestGenerate("generate")}>
      Skriv en oppsummering
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
          <h2 aria-label={`Netto ${signedNet(cashflow.netNok)}`}>
            <span
              aria-hidden
              className="mir-condensed block text-[clamp(4rem,20vw,6rem)] leading-[0.9] font-black tracking-[-0.02em] text-[var(--mir-accent)]"
            >
              {signedNet(cashflow.netNok)}
            </span>
          </h2>
          <ul className="space-y-1 text-lg">
            <li>
              {whole(cashflow.incomeNok)} inn, {whole(cashflow.spendNok)} ut.
            </li>
            {topCategory ? (
              <li>
                {topCategory.categoryName} toppet forbruket med{" "}
                {formatPercent(topCategory.share)}.
              </li>
            ) : null}
            {bills.count > 0 ? (
              <li>
                {whole(bills.totalNok)} i regninger, {whole(everyday.totalNok)}{" "}
                i hverdagskjøp.
              </li>
            ) : null}
          </ul>
        </div>
        <RecapVoice {...context} />
      </div>

      <nav
        aria-label="Forlat oppsummeringen"
        className="flex flex-wrap items-center gap-x-7 gap-y-3"
      >
        {adjacentMonths.previous ? (
          <Link
            to="/monthly-review/$monthStart"
            params={{ monthStart: adjacentMonths.previous }}
            className={exitLinkClassName}
          >
            <ArrowLeft aria-hidden className="size-4" />
            {formatMonthHeading(adjacentMonths.previous)}
          </Link>
        ) : null}
        <button type="button" onClick={onReplay} className={exitLinkClassName}>
          Spill av igjen
        </button>
        <Link
          to="/transactions"
          search={{ dateFrom, dateTo }}
          className={exitLinkClassName}
        >
          Se transaksjoner
        </Link>
        {adjacentMonths.next ? (
          <Link
            to="/monthly-review/$monthStart"
            params={{ monthStart: adjacentMonths.next }}
            className={exitLinkClassName}
          >
            {formatMonthHeading(adjacentMonths.next)}
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
    title: "Nettoresultat",
    world: (review) =>
      review.cashflow.netNok >= 0 ? DECK_WORLDS.positive : DECK_WORLDS.negative,
    isAvailable: hasActivity,
    render: (context) => <NetSlide {...context} />,
  },
  {
    id: "categories",
    title: "Hvor pengene gikk",
    world: () => DECK_WORLDS.brand,
    isAvailable: (review) => review.categories.length > 0,
    render: (context) => <CategoriesSlide {...context} />,
  },
  {
    id: "bills",
    title: "Regninger",
    world: () => DECK_WORLDS.neutral,
    isAvailable: (review) => review.bills.count > 0,
    render: (context) => <BillsSlide {...context} />,
  },
  {
    id: "merchants",
    title: "Topp brukersteder",
    world: () => DECK_WORLDS.brandSoft,
    isAvailable: (review) => review.everyday.topMerchants.length > 0,
    render: (context) => <MerchantsSlide {...context} />,
  },
  {
    id: "moments",
    title: "Øyeblikk",
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

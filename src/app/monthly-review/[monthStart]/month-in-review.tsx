"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { z } from "zod";
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
import type { MonthInReviewWithReview } from "@/lib/monthly-review/month-in-review";
import {
  formatMonthHeading,
  formatMonthStartLabel,
} from "../monthly-review-manager.utils";
import {
  type GenerateMode,
  MONTH_IN_REVIEW_SLIDES,
} from "./month-in-review.slides";
import { DECK_WORLDS, type DeckWorld } from "./month-in-review.worlds";
import { MonthInReviewSkeleton } from "./month-in-review-skeleton";
import "./month-in-review.css";

const reviewResponseSchema = z.object({
  review: z.object({ monthStart: z.string() }).passthrough(),
});

const TIMELINE_HREF = "/monthly-review";
const SWIPE_THRESHOLD_PX = 48;

type LoadError = "invalid-month" | "failed";

function worldStyle(world: DeckWorld): CSSProperties {
  return {
    "--mir-bg": world.background,
    "--mir-fg": world.foreground,
    "--mir-accent": world.accent,
    "--mir-muted": world.muted,
  } as CSSProperties;
}

const controlClassName =
  "inline-flex h-12 items-center gap-1.5 rounded-full px-5 font-bold text-base transition-opacity disabled:pointer-events-none disabled:opacity-25";

export function MonthInReview({
  monthStart,
  initialSlideId,
}: {
  monthStart: string;
  initialSlideId: string | null;
}) {
  const navigate = useNavigate({ from: "/monthly-review/$monthStart" });
  const monthLabel = formatMonthStartLabel(monthStart);
  const monthHeading = formatMonthHeading(monthStart);
  const [review, setReview] = useState<MonthInReviewWithReview | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [activeSlideId, setActiveSlideId] = useState(
    initialSlideId ?? MONTH_IN_REVIEW_SLIDES[0].id,
  );
  const [generateMode, setGenerateMode] = useState<GenerateMode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateFailed, setGenerateFailed] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const slideRef = useRef<HTMLElement>(null);

  const loadReview = useCallback(async () => {
    setLoadError(null);

    const response = await fetch(
      `/api/monthly-review/${encodeURIComponent(monthStart)}`,
    );
    const rawBody: unknown = await response.json().catch(() => null);
    const parsed = reviewResponseSchema.safeParse(rawBody);

    if (response.status === 400) {
      setLoadError("invalid-month");
      return;
    }

    if (!response.ok || !parsed.success) {
      setLoadError("failed");
      return;
    }

    setReview(parsed.data.review as unknown as MonthInReviewWithReview);
  }, [monthStart]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  useEffect(() => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, []);

  const slides = review
    ? MONTH_IN_REVIEW_SLIDES.filter((slide) => slide.isAvailable(review))
    : [];
  const activeIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === activeSlideId),
  );
  const activeSlide = slides[activeIndex];

  function goTo(index: number) {
    const target = slides[index];
    if (!target || index === activeIndex) {
      return;
    }

    setActiveSlideId(target.id);
    void navigate({ search: { slide: target.id }, replace: true });
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      generateMode !== null ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    const step: Record<string, () => void> = {
      ArrowRight: () => goTo(activeIndex + 1),
      ArrowLeft: () => goTo(activeIndex - 1),
      Home: () => goTo(0),
      End: () => goTo(slides.length - 1),
      Escape: () => void navigate({ to: TIMELINE_HREF }),
    };
    const action = step[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onSlidePointerDown(event: PointerEvent<HTMLElement>) {
    pointerStart.current =
      event.pointerType === "mouse"
        ? null
        : { x: event.clientX, y: event.clientY };
  }

  function onSlidePointerUp(event: PointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || (event.target as Element).closest("a, button")) {
      return;
    }

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      goTo(activeIndex + (dx < 0 ? 1 : -1));
      return;
    }

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - bounds.left) / bounds.width;
    if (fraction < 1 / 3) {
      goTo(activeIndex - 1);
    } else if (fraction > 2 / 3) {
      goTo(activeIndex + 1);
    }
  }

  async function handleConfirmGenerate() {
    if (isGenerating) {
      return;
    }

    setGenerateMode(null);
    setGenerateFailed(false);
    setIsGenerating(true);

    const response = await fetch("/api/monthly-review/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ monthStart }),
    });

    setGenerateFailed(!response.ok);
    await loadReview();
    setIsGenerating(false);
  }

  if (loadError) {
    return (
      <div
        className="mir-deck fixed inset-0 z-50 flex flex-col items-start justify-center gap-5 px-6 md:px-12"
        style={worldStyle(DECK_WORLDS.base)}
      >
        <h1 className="font-extrabold text-3xl text-[var(--mir-accent)] md:text-5xl">
          {monthHeading}
        </h1>
        <p role="alert" className="text-lg">
          {loadError === "invalid-month"
            ? "Den måneden er ikke gyldig. Velg en måned fra tidslinjen."
            : "Kunne ikke laste inn denne måneden. Prøv igjen."}
        </p>
        <div className="flex gap-6 font-semibold underline decoration-2 underline-offset-[0.22em]">
          {loadError === "failed" ? (
            <button type="button" onClick={() => void loadReview()}>
              Prøv igjen
            </button>
          ) : null}
          <Link to={TIMELINE_HREF}>Tilbake til tidslinjen</Link>
        </div>
      </div>
    );
  }

  if (!review || !activeSlide) {
    return <MonthInReviewSkeleton />;
  }

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === slides.length - 1;

  return (
    <div
      className="mir-deck fixed inset-0 z-50 flex flex-col"
      style={worldStyle(activeSlide.world(review))}
    >
      <header className="flex flex-col gap-1 px-4 pt-3 md:px-8 md:pt-4">
        <nav aria-label="Lysbilder" className="flex gap-1.5">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Gå til lysbilde ${index + 1}: ${slide.title}`}
              aria-current={index === activeIndex ? "step" : undefined}
              className="group flex-1 rounded-full py-2"
            >
              <span
                className={`block h-1 rounded-full transition-opacity duration-300 ${
                  index <= activeIndex
                    ? "bg-[var(--mir-accent)]"
                    : "mir-track group-hover:opacity-70"
                }`}
              />
            </button>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-4">
          <Link
            to={TIMELINE_HREF}
            aria-label="Lukk måneden som gikk"
            className="-ml-2 inline-flex size-10 items-center justify-center rounded-full hover:bg-[color-mix(in_oklab,var(--mir-accent)_14%,transparent)]"
          >
            <X aria-hidden className="size-6" />
          </Link>
          <h1
            className={`mir-expanded font-bold text-sm tracking-[0.02em] ${
              activeSlide.id === "intro" ? "sr-only" : ""
            }`}
          >
            <span className="sr-only">Måneden som gikk: </span>
            {monthHeading}
          </h1>
          <span className="size-10" aria-hidden />
        </div>
      </header>

      <section
        key={activeSlide.id}
        ref={slideRef}
        tabIndex={-1}
        aria-roledescription="lysbilde"
        aria-label={`${activeIndex + 1} av ${slides.length}: ${activeSlide.title}`}
        onPointerDown={onSlidePointerDown}
        onPointerUp={onSlidePointerUp}
        className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto focus-visible:outline-none"
      >
        <div className="mx-auto my-auto w-full max-w-5xl px-6 py-6 md:px-12">
          {activeSlide.render({
            review,
            monthLabel,
            isGenerating,
            generateFailed,
            onRequestGenerate: setGenerateMode,
            onReplay: () => goTo(0),
          })}
        </div>
      </section>

      <footer className="flex items-center justify-between gap-4 px-4 pt-2 pb-4 md:px-8 md:pb-6">
        <button
          type="button"
          onClick={() => goTo(activeIndex - 1)}
          disabled={isFirst}
          className={`${controlClassName} border-2 border-[var(--mir-accent)] text-[var(--mir-accent)]`}
        >
          <ChevronLeft aria-hidden className="size-5" />
          Forrige
        </button>
        <button
          type="button"
          onClick={() => goTo(activeIndex + 1)}
          disabled={isLast}
          className={`${controlClassName} bg-[var(--mir-accent)] text-[var(--mir-bg)]`}
        >
          Neste
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </footer>

      <AlertDialog
        open={generateMode !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setGenerateMode(null);
          }
        }}
      >
        <AlertDialogContent finalFocus={slideRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {generateMode === "regenerate"
                ? "Skrive oppsummeringen på nytt?"
                : "Skrive en oppsummering?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {generateMode === "regenerate"
                ? `Dette erstatter den nåværende oppsummeringen for ${monthLabel}.`
                : `Dette skriver en kort oppsummering av ${monthLabel} basert på tallene i denne gjennomgangen.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmGenerate()}>
              {generateMode === "regenerate" ? "Skriv på nytt" : "Skriv den"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

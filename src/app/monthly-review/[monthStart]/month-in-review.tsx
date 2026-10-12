"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useState } from "react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import type { MonthInReviewWithReview } from "@/lib/monthly-review/month-in-review";
import { formatMonthStartLabel } from "../monthly-review-manager.utils";
import {
  type GenerateMode,
  MONTH_IN_REVIEW_SLIDES,
} from "./month-in-review.slides";

const reviewResponseSchema = z.object({
  review: z.object({ monthStart: z.string() }).passthrough(),
});

type LoadError = "invalid-month" | "failed";

export function MonthInReview({ monthStart }: { monthStart: string }) {
  const monthLabel = formatMonthStartLabel(monthStart);
  const [review, setReview] = useState<MonthInReviewWithReview | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [activeSlideId, setActiveSlideId] = useState(
    MONTH_IN_REVIEW_SLIDES[0].id,
  );
  const [direction, setDirection] = useState<1 | -1>(1);
  const [generateMode, setGenerateMode] = useState<GenerateMode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

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

  const slides = review
    ? MONTH_IN_REVIEW_SLIDES.filter((slide) => slide.isAvailable(review))
    : [];
  const activeIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === activeSlideId),
  );
  const activeSlide = slides[activeIndex];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === slides.length - 1;

  function goTo(index: number) {
    const target = slides[index];
    if (!target || index === activeIndex) {
      return;
    }

    setDirection(index > activeIndex ? 1 : -1);
    setActiveSlideId(target.id);
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

    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(activeIndex - 1);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function requestGenerate(mode: GenerateMode) {
    setGenerateError(null);
    setGenerateMode(mode);
  }

  async function handleConfirmGenerate() {
    if (isGenerating) {
      return;
    }

    setGenerateMode(null);
    setGenerateError(null);
    setIsGenerating(true);

    const response = await fetch("/api/monthly-review/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ monthStart }),
    });

    if (!response.ok) {
      setGenerateError(
        "Could not start monthly review generation. Please try again.",
      );
    }

    await loadReview();
    setIsGenerating(false);
  }

  const header = (
    <div className="flex items-center justify-between gap-4">
      <Link
        href="/monthly-review"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft aria-hidden />
        Back to timeline
      </Link>
      <h1 className="font-semibold text-muted-foreground text-sm uppercase tracking-[0.2em]">
        {monthLabel} in review
      </h1>
      <span className="min-w-16 text-right text-muted-foreground text-sm tabular-nums">
        {slides.length > 0 ? `${activeIndex + 1} / ${slides.length}` : null}
      </span>
    </div>
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <div className="space-y-3">
          <p
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          >
            {loadError === "invalid-month"
              ? "That month is not valid. Pick a month from the timeline."
              : "Could not load month in review."}
          </p>
          {loadError === "failed" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadReview()}
            >
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!review || !activeSlide) {
    return (
      <div className="space-y-6">
        {header}
        <output className="flex items-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading month in review...
        </output>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <nav aria-label="Slides" className="flex gap-1.5">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Go to slide ${index + 1}: ${slide.title}`}
            aria-current={index === activeIndex ? "step" : undefined}
            className="group flex-1 py-2 outline-none"
          >
            <span
              className={`block h-1.5 rounded-full transition-colors duration-300 group-focus-visible:ring-2 group-focus-visible:ring-ring ${
                index <= activeIndex
                  ? "bg-foreground"
                  : "bg-muted-foreground/25 group-hover:bg-muted-foreground/50"
              }`}
            />
          </button>
        ))}
      </nav>

      <section
        key={activeSlide.id}
        aria-roledescription="slide"
        aria-label={`${activeIndex + 1} of ${slides.length}: ${activeSlide.title}`}
        className={`fade-in flex min-h-[30rem] animate-in flex-col justify-center rounded-3xl p-8 duration-300 ease-out motion-reduce:animate-none md:min-h-[34rem] md:p-14 ${
          direction === 1 ? "slide-in-from-right-6" : "slide-in-from-left-6"
        } ${activeSlide.toneClassName}`}
      >
        {activeSlide.render({
          review,
          monthLabel,
          isGenerating,
          onRequestGenerate: requestGenerate,
        })}
        {generateError && activeSlide.id === "ai-recap" ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          >
            {generateError}
          </p>
        ) : null}
      </section>

      <div className="flex items-center justify-between gap-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => goTo(activeIndex - 1)}
          disabled={isFirst}
        >
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        <p className="hidden text-muted-foreground text-xs sm:block">
          Use the arrow keys to flip through
        </p>
        <Button
          type="button"
          size="lg"
          onClick={() => goTo(activeIndex + 1)}
          disabled={isLast}
        >
          Next
          <ChevronRight aria-hidden />
        </Button>
      </div>

      <AlertDialog
        open={generateMode !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setGenerateMode(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {generateMode === "regenerate"
                ? "Regenerate monthly review?"
                : "Generate monthly review?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {generateMode === "regenerate"
                ? `This will replace the existing review text for ${monthLabel}.`
                : `This will generate a monthly AI review for ${monthLabel}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmGenerate()}>
              {generateMode === "regenerate"
                ? "Regenerate now"
                : "Generate now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

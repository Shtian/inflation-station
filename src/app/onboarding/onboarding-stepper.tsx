"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  ONBOARDING_STEPS,
  type OnboardingStep,
  type OnboardingStepStatus,
  resolveStepStatus,
  type SetupSnapshot,
} from "@/lib/onboarding/progress";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<OnboardingStepStatus, string> = {
  done: "Ferdig",
  current: "Nåværende steg",
  upcoming: "Neste",
};

const MANAGE_LABELS: Record<OnboardingStep["manageHref"], string> = {
  "/accounts": "Eller legg dem til på Kontoer-siden",
  "/categories": "Eller legg dem til på Kategorier-siden",
};

export function OnboardingStepper({
  snapshot,
}: {
  snapshot: SetupSnapshot | null;
}) {
  return (
    <ol aria-label="Oppsettssteg" className="flex flex-col gap-5">
      {ONBOARDING_STEPS.map((step, index) => {
        const status = snapshot ? resolveStepStatus(step, snapshot) : null;
        const items = snapshot ? step.presentItems(snapshot) : [];
        return (
          <li
            key={step.id}
            aria-current={status === "current" ? "step" : undefined}
            className="flex gap-3"
          >
            <span
              aria-hidden
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full font-semibold text-xs",
                status === "done" && "bg-brand text-brand-foreground",
                status === "current" &&
                  "bg-brand/15 text-brand ring-2 ring-brand",
                (status === "upcoming" || status === null) &&
                  "bg-muted text-muted-foreground",
              )}
            >
              {status === "done" ? <Check className="size-4" /> : index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h2 className="font-medium text-foreground text-sm">
                  {step.title}
                </h2>
                <span
                  className={cn(
                    "text-xs",
                    status === "current"
                      ? "font-medium text-brand"
                      : "text-muted-foreground",
                  )}
                >
                  {status ? STATUS_LABELS[status] : "Sjekker…"}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {step.description}
              </p>
              {items.length > 0 ? (
                <ul
                  aria-label={`${step.title}: allerede lagt til`}
                  className="flex flex-wrap gap-1 pt-1"
                >
                  {items.map((item) => (
                    <li
                      key={item}
                      className="rounded-md bg-muted px-1.5 py-0.5 text-foreground text-xs"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link
                href={step.manageHref}
                className={cn(
                  buttonVariants({ variant: "link", size: "xs" }),
                  "h-auto self-start px-0 text-muted-foreground",
                )}
              >
                {MANAGE_LABELS[step.manageHref]}
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

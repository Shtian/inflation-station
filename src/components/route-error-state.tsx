"use client";

import * as Sentry from "@sentry/nextjs";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type RouteErrorStateProps = {
  actionLabel?: string;
  error: Error;
  message: string;
  onRetry: () => void;
  title: string;
};

export function RouteErrorState({
  actionLabel = "Prøv igjen",
  error,
  message,
  onRetry,
  title,
}: RouteErrorStateProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-6xl items-center justify-center px-5 py-16 md:px-10">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert
            className="mt-0.5 h-5 w-5 text-destructive"
            aria-hidden
          />
          <div className="space-y-1">
            <h1 className="font-semibold text-base text-foreground">{title}</h1>
            <p className="text-muted-foreground text-sm">{message}</p>
          </div>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={onRetry}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </main>
  );
}

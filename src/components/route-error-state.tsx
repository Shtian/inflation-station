"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type RouteErrorStateProps = {
  actionLabel?: string;
  message: string;
  onRetry: () => void;
  title: string;
};

export function RouteErrorState({
  actionLabel = "Retry",
  message,
  onRetry,
  title,
}: RouteErrorStateProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl items-center justify-center px-5 py-16 md:px-10">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert
            className="mt-0.5 h-5 w-5 text-destructive"
            aria-hidden
          />
          <div className="space-y-1">
            <h1 className="text-base font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
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

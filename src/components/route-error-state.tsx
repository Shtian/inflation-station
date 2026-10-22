"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { RouteErrorCard } from "@/components/route-error-card";

type RouteErrorStateProps = {
  actionLabel?: string;
  error: Error;
  message: string;
  onRetry: () => void;
  title: string;
};

export function RouteErrorState({ error, ...card }: RouteErrorStateProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return <RouteErrorCard {...card} />;
}

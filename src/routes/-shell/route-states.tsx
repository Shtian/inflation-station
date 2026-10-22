import * as Sentry from "@sentry/tanstackstart-react";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { RouteErrorCard } from "@/components/route-error-card";
import { RouteLoadingState } from "@/components/route-loading-state";

type RouteErrorProps = ErrorComponentProps & {
  title: string;
  fallbackMessage: string;
};

/** Start counterpart of `@/components/route-error-state`. */
export function RouteError({
  error,
  reset,
  title,
  fallbackMessage,
}: RouteErrorProps) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <RouteErrorCard
      title={title}
      message={(error instanceof Error && error.message) || fallbackMessage}
      onRetry={() => {
        reset();
        void router.invalidate();
      }}
    />
  );
}

export function DefaultRouteError(props: ErrorComponentProps) {
  return (
    <RouteError
      {...props}
      title="Noe gikk galt"
      fallbackMessage="Det oppstod en uventet feil i appen."
    />
  );
}

export function DefaultRoutePending() {
  return <RouteLoadingState label="Laster inn…" />;
}

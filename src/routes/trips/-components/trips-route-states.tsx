import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { RouteLoadingState } from "@/components/route-loading-state";
import { Button } from "@/components/ui/button";

export function TripsPending() {
  return <RouteLoadingState label="Laster inn turer…" />;
}

/** Start copy of `@/components/route-error-state` for the trips routes, without Sentry. */
export function TripsError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <main className="mx-auto flex w-full max-w-6xl items-center justify-center px-5 py-16 md:px-10">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert
            className="mt-0.5 h-5 w-5 text-destructive"
            aria-hidden
          />
          <div className="space-y-1">
            <h1 className="font-semibold text-base text-foreground">
              Kunne ikke laste inn turer
            </h1>
            <p className="text-muted-foreground text-sm">
              {(error instanceof Error && error.message) ||
                "Det oppstod en uventet feil under lasting av turer."}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Button
            type="button"
            onClick={() => {
              reset();
              void router.invalidate();
            }}
          >
            Prøv igjen
          </Button>
        </div>
      </div>
    </main>
  );
}

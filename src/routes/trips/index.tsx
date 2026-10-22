import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { EmptySectionText } from "@/app/trips/components/trip-section";
import { Button } from "@/components/ui/button";
import { TripFormDialog } from "./-components/trip-form-dialog";
import { TripList } from "./-components/trip-list";
import { TripsError, TripsPending } from "./-components/trips-route-states";
import { getTripList } from "./-server";

export const Route = createFileRoute("/trips/")({
  loader: () => getTripList(),
  pendingComponent: TripsPending,
  errorComponent: TripsError,
  component: TripsPage,
});

function TripsPage() {
  const trips = Route.useLoaderData();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 md:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl text-foreground tracking-tight">
            Turer
          </h1>
          <p className="text-muted-foreground text-sm">
            Hva reisene kostet, med bestillinger gjort før avreise.
          </p>
        </div>
        <TripFormDialog
          trigger={
            <Button>
              <Plus aria-hidden />
              Ny tur
            </Button>
          }
        />
      </div>

      {trips.length > 0 ? (
        <TripList trips={trips} />
      ) : (
        <div className="space-y-3">
          <EmptySectionText>
            Ingen turer ennå. Opprett en tur og velg transaksjonene som hører
            til.
          </EmptySectionText>
          <TripFormDialog
            trigger={<Button variant="outline">Opprett en tur</Button>}
          />
        </div>
      )}
    </main>
  );
}

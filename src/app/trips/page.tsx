import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { loadTripList } from "@/lib/trips/load";
import { TripFormDialog } from "./components/trip-form-dialog";
import { TripList } from "./components/trip-list";
import { EmptySectionText } from "./components/trip-section";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const trips = await loadTripList(prisma);

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
        <EmptySectionText>
          Ingen turer ennå. Opprett en tur og velg transaksjonene som hører til.
        </EmptySectionText>
      )}
    </main>
  );
}

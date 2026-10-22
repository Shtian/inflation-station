import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CategoryBreakdown } from "@/app/trips/components/category-breakdown";
import { TripEditTabs } from "@/app/trips/components/trip-edit-tabs";
import {
  EmptySectionText,
  TripSection,
} from "@/app/trips/components/trip-section";
import { formatAmount, formatDays, formatTripRange } from "@/app/trips/format";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { TripCandidate } from "@/lib/trips/summary";
import { DeleteTripButton } from "./-components/delete-trip-button";
import { TripChecklist } from "./-components/trip-checklist";
import { TripFormDialog } from "./-components/trip-form-dialog";
import { TripSearchForm } from "./-components/trip-search-form";
import { TripTransactions } from "./-components/trip-transactions";
import { TripsError, TripsPending } from "./-components/trips-route-states";
import {
  getTripPage,
  TRIP_SEARCH_KEYS,
  type TripSearchParams,
} from "./-server";

/** The router decodes `?belop=120` to a number and `?q=true` to a boolean; `parseTripSearch` takes the strings as typed. */
function validateSearch(search: Record<string, unknown>): TripSearchParams {
  const params: TripSearchParams = {};
  for (const key of TRIP_SEARCH_KEYS) {
    const value = search[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      params[key] = String(value);
    }
  }
  return params;
}

export const Route = createFileRoute("/trips/$tripId")({
  validateSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ params, deps }) =>
    getTripPage({ data: { tripId: params.tripId, search: deps.search } }),
  pendingComponent: TripsPending,
  errorComponent: TripsError,
  component: TripPage,
});

/** Remounts a checklist when membership changes elsewhere on the page, so its checkboxes start from the stored state. */
function membershipKey(candidates: TripCandidate[]): string {
  return candidates
    .map((candidate) => `${candidate.id}:${candidate.trip?.id ?? ""}`)
    .join("|");
}

function TripPage() {
  const data = Route.useLoaderData();
  const { summary, inRange, search } = data;
  const memberCount = summary.beforeTrip.length + summary.duringTrip.length;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 md:px-10">
      <div className="space-y-3">
        <Link
          to="/trips"
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Turer
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-semibold text-2xl text-foreground tracking-tight">
              {summary.name}
            </h1>
            <p className="text-muted-foreground text-sm tabular-nums">
              {formatTripRange(summary.startDate, summary.endDate)} ·{" "}
              {formatDays(summary.days)}
            </p>
          </div>
          <div className="flex gap-2">
            <TripFormDialog
              trip={summary}
              trigger={<Button variant="outline">Rediger</Button>}
            />
            <DeleteTripButton tripId={summary.id} name={summary.name} />
          </div>
        </div>
      </div>

      <dl aria-label="Kostnad" className="flex flex-wrap gap-x-10 gap-y-4">
        <div className="space-y-1">
          <dt className="text-muted-foreground text-sm">Totalt</dt>
          <dd className="font-mono font-semibold text-foreground text-lg tabular-nums tracking-tight">
            {formatAmount(summary.costNok)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground text-sm">Per dag</dt>
          <dd className="font-mono font-semibold text-foreground text-lg tabular-nums tracking-tight">
            {formatAmount(summary.perDayNok)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground text-sm">Transaksjoner</dt>
          <dd className="font-semibold text-foreground text-lg tabular-nums tracking-tight">
            {memberCount}
          </dd>
        </div>
      </dl>

      {summary.byCategory.length > 0 ? (
        <CategoryBreakdown items={summary.byCategory} />
      ) : null}

      {memberCount > 0 ? (
        <>
          <TripSection id="trip-before" title="Før turen">
            {summary.beforeTrip.length > 0 ? (
              <TripTransactions
                tripId={summary.id}
                label="Før turen"
                transactions={summary.beforeTrip}
              />
            ) : (
              <EmptySectionText>Ingen bestillinger før turen.</EmptySectionText>
            )}
          </TripSection>

          <TripSection id="trip-during" title="Under turen">
            {summary.duringTrip.length > 0 ? (
              <TripTransactions
                tripId={summary.id}
                label="Under turen"
                transactions={summary.duringTrip}
              />
            ) : (
              <EmptySectionText>
                Ingen transaksjoner under turen.
              </EmptySectionText>
            )}
          </TripSection>
        </>
      ) : (
        <EmptySectionText>
          Ingen transaksjoner på turen ennå. Velg dem under.
        </EmptySectionText>
      )}

      <Separator />

      <TripSection id="trip-edit" title="Rediger utvalg">
        <TripEditTabs
          initialTab={search ? "search" : "in-range"}
          navigationKey={JSON.stringify(search?.query ?? null)}
          inRange={
            inRange.length > 0 ? (
              <>
                <EmptySectionText>
                  {memberCount === 0
                    ? "På en ny tur er utgiftene krysset av på forhånd. Fjern det som ikke hørte til turen."
                    : "Transaksjoner i perioden som ikke er på turen. Kryss av for å legge dem til."}
                </EmptySectionText>
                <TripChecklist
                  key={membershipKey(inRange)}
                  tripId={summary.id}
                  candidates={inRange}
                  label="Transaksjoner i perioden"
                  submitLabel="Lagre utvalg"
                />
              </>
            ) : (
              <EmptySectionText>
                {memberCount === 0
                  ? "Ingen transaksjoner i perioden ennå."
                  : "Alle transaksjoner i perioden er på turen."}
              </EmptySectionText>
            )
          }
          search={
            <>
              <EmptySectionText>
                Finn bestillinger utenfor turens datoer, som fly, hotell og
                leiebil.
              </EmptySectionText>
              <TripSearchForm
                key={JSON.stringify(search?.query ?? null)}
                tripId={summary.id}
                query={search?.query ?? null}
              />
              {search ? (
                search.results.length > 0 ? (
                  <>
                    <TripChecklist
                      key={membershipKey(search.results)}
                      tripId={summary.id}
                      candidates={search.results}
                      label="Søkeresultater"
                      submitLabel="Legg til valgte"
                    />
                    {search.truncated ? (
                      <EmptySectionText>
                        Viser de {search.results.length} nyeste treffene. Snevre
                        inn søket for å se flere.
                      </EmptySectionText>
                    ) : null}
                  </>
                ) : (
                  <EmptySectionText>Ingen treff.</EmptySectionText>
                )
              ) : null}
            </>
          }
        />
      </TripSection>
    </main>
  );
}

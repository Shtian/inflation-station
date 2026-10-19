import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/prisma";
import { loadTripPage, parseTripSearch } from "@/lib/trips/load";
import type { TripCandidate } from "@/lib/trips/summary";
import { CategoryBreakdown } from "../components/category-breakdown";
import { DeleteTripButton } from "../components/delete-trip-button";
import { TripChecklist } from "../components/trip-checklist";
import { TripDisclosure } from "../components/trip-disclosure";
import { TripFormDialog } from "../components/trip-form-dialog";
import { TripSearchForm } from "../components/trip-search-form";
import { EmptySectionText, TripSection } from "../components/trip-section";
import { TripTransactions } from "../components/trip-transactions";
import { formatAmount, formatDays, formatTripRange } from "../format";

export const dynamic = "force-dynamic";

/** Remounts a checklist when membership changes elsewhere on the page, so its checkboxes start from the stored state. */
function membershipKey(candidates: TripCandidate[]): string {
  return candidates
    .map((candidate) => `${candidate.id}:${candidate.trip?.id ?? ""}`)
    .join("|");
}

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tripId } = await params;
  const data = await loadTripPage(
    prisma,
    tripId,
    parseTripSearch(await searchParams),
  );
  if (!data) {
    notFound();
  }

  const { summary, inRange, search } = data;
  const memberCount = summary.beforeTrip.length + summary.duringTrip.length;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 md:px-10">
      <div className="space-y-3">
        <Link
          href="/trips"
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
          <dd className="font-semibold text-2xl text-foreground tabular-nums tracking-tight">
            {formatAmount(summary.costNok)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground text-sm">Per dag</dt>
          <dd className="font-semibold text-2xl text-foreground tabular-nums tracking-tight">
            {formatAmount(summary.perDayNok)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground text-sm">Transaksjoner</dt>
          <dd className="font-semibold text-2xl text-foreground tabular-nums tracking-tight">
            {memberCount}
          </dd>
        </div>
      </dl>

      {summary.byCategory.length > 0 ? (
        <CategoryBreakdown items={summary.byCategory} />
      ) : null}

      <Separator />

      <TripSection
        id="trip-in-range"
        title="Transaksjoner i perioden"
        description="Utgifter er krysset av på forhånd. Fjern det som ikke hørte til turen, som husleie."
      >
        {inRange.length > 0 ? (
          <TripDisclosure
            title={`Velg blant ${inRange.length} ${inRange.length === 1 ? "transaksjon" : "transaksjoner"}`}
            defaultOpen={memberCount === 0}
          >
            <TripChecklist
              key={membershipKey(inRange)}
              tripId={summary.id}
              candidates={inRange}
              label="Transaksjoner i perioden"
              submitLabel="Lagre utvalg"
            />
          </TripDisclosure>
        ) : (
          <EmptySectionText>
            Ingen transaksjoner i perioden ennå.
          </EmptySectionText>
        )}
      </TripSection>

      <TripSection
        id="trip-search"
        title="Legg til transaksjoner"
        description="Finn bestillinger utenfor turens datoer, som fly, hotell og leiebil."
      >
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
                  Viser de {search.results.length} nyeste treffene. Snevre inn
                  søket for å se flere.
                </EmptySectionText>
              ) : null}
            </>
          ) : (
            <EmptySectionText>Ingen treff.</EmptySectionText>
          )
        ) : null}
      </TripSection>

      <Separator />

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
          <EmptySectionText>Ingen transaksjoner under turen.</EmptySectionText>
        )}
      </TripSection>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AttentionStrip } from "@/app/subscriptions/components/attention-strip";
import { SubscriptionDisclosure } from "@/app/subscriptions/components/subscription-disclosure";
import {
  EmptySectionText,
  SubscriptionSection,
} from "@/app/subscriptions/components/subscription-section";
import {
  SubscriptionTable,
  untracked,
} from "@/app/subscriptions/components/subscription-table";
import { SubscriptionTotals } from "@/app/subscriptions/components/subscription-totals";
import { Separator } from "@/components/ui/separator";
import { hasMissedCharge } from "@/lib/subscriptions/review";
import {
  SubscriptionsError,
  SubscriptionsPending,
} from "./-components/subscriptions-route-states";
import { getSubscriptionReview } from "./-server";

export const Route = createFileRoute("/subscriptions/")({
  loader: () => getSubscriptionReview(),
  head: () => ({ meta: [{ title: "Faste trekk · Inflation Station" }] }),
  pendingComponent: SubscriptionsPending,
  errorComponent: SubscriptionsError,
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const review = Route.useLoaderData();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 md:px-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Faste trekk
        </h1>
        <p className="text-sm text-muted-foreground">
          Trekk som går igjen hver måned eller hvert år, funnet i transaksjonene
          dine.
        </p>
      </div>

      {review.confirmed.length > 0 ? (
        <SubscriptionTotals totals={review.totals} />
      ) : null}

      <AttentionStrip subscriptions={[...review.confirmed, ...review.ended]} />

      <SubscriptionSection
        id="subscriptions-confirmed"
        title="Bekreftet"
        description="Faste trekk du har bekreftet. Prisendringer og trekk som uteblir blir markert her på siden."
      >
        {review.confirmed.length > 0 ? (
          <SubscriptionTable
            rows={review.confirmed.map((subscription) => ({
              ...subscription,
              // Clearing a lapsed subscription would hide it everywhere, so it can only be ended.
              actions: hasMissedCharge(subscription.alerts)
                ? ["END"]
                : ["UNCONFIRM"],
            }))}
          />
        ) : (
          <EmptySectionText>
            Ingen bekreftede faste trekk ennå. Bekreft et forslag nedenfor.
          </EmptySectionText>
        )}
      </SubscriptionSection>

      <Separator />

      <SubscriptionSection
        id="subscriptions-suggested"
        title="Forslag"
        description="Brukersteder som har trukket omtrent samme beløp minst tre ganger med fast mellomrom."
      >
        {review.suggested.length > 0 ? (
          <SubscriptionTable
            rows={review.suggested.map((candidate) => ({
              ...untracked(candidate),
              actions: ["CONFIRM", "DISMISS"],
            }))}
          />
        ) : (
          <EmptySectionText>Ingen nye forslag.</EmptySectionText>
        )}
      </SubscriptionSection>

      {review.ended.length > 0 || review.dismissed.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-4">
            {review.ended.length > 0 ? (
              <SubscriptionDisclosure
                title="Avsluttet"
                count={review.ended.length}
              >
                <SubscriptionTable
                  ended
                  rows={review.ended.map((subscription) => ({
                    ...subscription,
                    actions: ["RECONFIRM"],
                  }))}
                />
              </SubscriptionDisclosure>
            ) : null}
            {review.dismissed.length > 0 ? (
              <SubscriptionDisclosure
                title="Avviste"
                count={review.dismissed.length}
              >
                <SubscriptionTable
                  rows={review.dismissed.map((candidate) => ({
                    ...untracked(candidate),
                    actions: ["RESTORE"],
                  }))}
                />
              </SubscriptionDisclosure>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}

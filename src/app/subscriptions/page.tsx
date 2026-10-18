import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/prisma";
import { loadSubscriptionReview } from "@/lib/subscriptions/load";
import { ConfirmedSubscriptions } from "./components/confirmed-subscriptions";
import { DismissedSubscriptions } from "./components/dismissed-subscriptions";
import {
  EmptySectionText,
  SubscriptionSection,
} from "./components/subscription-section";
import { SubscriptionTotals } from "./components/subscription-totals";
import { SuggestedSubscriptions } from "./components/suggested-subscriptions";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const review = await loadSubscriptionReview(
    prisma,
    format(new Date(), "yyyy-MM-dd"),
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 md:px-10">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Faste trekk
        </h1>
        <p className="text-muted-foreground text-sm">
          Trekk som går igjen hver måned eller hvert år, funnet i transaksjonene
          dine.
        </p>
      </div>

      {review.confirmed.length > 0 ? (
        <SubscriptionTotals totals={review.totals} />
      ) : null}

      <SubscriptionSection
        id="subscriptions-confirmed"
        title="Bekreftet"
        description="Faste trekk du har bekreftet. Vi varsler når prisen endrer seg eller et trekk uteblir."
      >
        {review.confirmed.length > 0 ? (
          <ConfirmedSubscriptions subscriptions={review.confirmed} />
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
          <SuggestedSubscriptions candidates={review.suggested} />
        ) : (
          <EmptySectionText>Ingen nye forslag.</EmptySectionText>
        )}
      </SubscriptionSection>

      {review.dismissed.length > 0 ? (
        <>
          <Separator />
          <DismissedSubscriptions candidates={review.dismissed} />
        </>
      ) : null}
    </main>
  );
}

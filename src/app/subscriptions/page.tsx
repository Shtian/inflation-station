import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/prisma";
import { loadSubscriptionReview } from "@/lib/subscriptions/load";
import { hasMissedCharge } from "@/lib/subscriptions/review";
import { SubscriptionDisclosure } from "./components/subscription-disclosure";
import {
  EmptySectionText,
  SubscriptionSection,
} from "./components/subscription-section";
import { SubscriptionTable, untracked } from "./components/subscription-table";
import { SubscriptionTotals } from "./components/subscription-totals";

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

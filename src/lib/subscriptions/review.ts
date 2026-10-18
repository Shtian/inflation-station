import {
  CADENCES,
  daysBetween,
  type IsoDay,
  type RecurringCandidate,
  roundNok,
  type SubscriptionAlert,
  type SubscriptionDecisionStatus,
} from "./model";

export type ConfirmedSubscription = {
  candidate: RecurringCandidate;
  alerts: SubscriptionAlert[];
};

export type SubscriptionReview = {
  confirmed: ConfirmedSubscription[];
  suggested: RecurringCandidate[];
  dismissed: RecurringCandidate[];
  totals: { monthlyNok: number; yearlyNok: number };
};

/** Decision per `normalizedMerchant`; one decision covers every candidate at that merchant. */
export type SubscriptionDecisions = ReadonlyMap<
  string,
  SubscriptionDecisionStatus
>;

const PRICE_TOLERANCE_NOK = 1;
const PRICE_TOLERANCE_RATIO = 0.01;

export function reviewSubscriptions(
  candidates: readonly RecurringCandidate[],
  decisions: SubscriptionDecisions,
  today: IsoDay,
): SubscriptionReview {
  const review: SubscriptionReview = {
    confirmed: [],
    suggested: [],
    dismissed: [],
    totals: { monthlyNok: 0, yearlyNok: 0 },
  };

  for (const candidate of candidates) {
    const decision = decisions.get(candidate.normalizedMerchant);
    if (decision === "CONFIRMED") {
      review.confirmed.push({ candidate, alerts: alertsFor(candidate, today) });
    } else if (overdueDays(candidate, today) === null) {
      // A lapsed charge is most likely cancelled, so it is not worth deciding on.
      (decision === "DISMISSED" ? review.dismissed : review.suggested).push(
        candidate,
      );
    }
  }

  const yearlyNok = roundNok(
    review.confirmed.reduce(
      (sum, { candidate }) => sum + candidate.annualizedNok,
      0,
    ),
  );
  review.totals = { yearlyNok, monthlyNok: roundNok(yearlyNok / 12) };

  return review;
}

function alertsFor(
  candidate: RecurringCandidate,
  today: IsoDay,
): SubscriptionAlert[] {
  const alerts: SubscriptionAlert[] = [];
  const { charges } = candidate;
  const latest = charges[charges.length - 1];
  const previous = charges[charges.length - 2];

  const tolerance = Math.max(
    PRICE_TOLERANCE_NOK,
    previous.amountNok * PRICE_TOLERANCE_RATIO,
  );
  if (Math.abs(latest.amountNok - previous.amountNok) > tolerance) {
    alerts.push({
      kind: "PRICE_CHANGE",
      fromNok: previous.amountNok,
      toNok: latest.amountNok,
      changedOn: latest.date,
    });
  }

  const daysOverdue = overdueDays(candidate, today);
  if (daysOverdue !== null) {
    alerts.push({
      kind: "MISSED_CHARGE",
      expectedOn: candidate.nextExpectedDate,
      daysOverdue,
    });
  }

  return alerts;
}

/** Days past the expected charge, or null while still inside the grace window. */
function overdueDays(candidate: RecurringCandidate, today: IsoDay) {
  const days = daysBetween(candidate.nextExpectedDate, today);
  return days > CADENCES[candidate.cadence].graceDays ? days : null;
}

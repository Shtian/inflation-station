import {
  CADENCES,
  daysBetween,
  type IsoDay,
  type RecurringCandidate,
  roundNok,
  type SubscriptionAlert,
  type SubscriptionDecisionStatus,
} from "./model";

export type TrackedSubscription = {
  candidate: RecurringCandidate;
  alerts: SubscriptionAlert[];
};

export type SubscriptionReview = {
  confirmed: TrackedSubscription[];
  ended: TrackedSubscription[];
  suggested: RecurringCandidate[];
  dismissed: RecurringCandidate[];
  totals: {
    monthlyNok: number;
    yearlyNok: number;
    /** Confirmed subscriptions left out of the totals because a charge is missing. */
    excluded: RecurringCandidate[];
  };
};

export type SubscriptionDecision = {
  status: SubscriptionDecisionStatus;
  decidedOn: IsoDay;
};

/** Decision per `normalizedMerchant`; one decision covers every candidate at that merchant. */
export type SubscriptionDecisions = ReadonlyMap<string, SubscriptionDecision>;

const PRICE_TOLERANCE_NOK = 1;
const PRICE_TOLERANCE_RATIO = 0.01;

export function reviewSubscriptions(
  candidates: readonly RecurringCandidate[],
  decisions: SubscriptionDecisions,
  today: IsoDay,
): SubscriptionReview {
  const confirmed: TrackedSubscription[] = [];
  const ended: TrackedSubscription[] = [];
  const suggested: RecurringCandidate[] = [];
  const dismissed: RecurringCandidate[] = [];

  for (const candidate of candidates) {
    const decision = decisions.get(candidate.normalizedMerchant);
    switch (decision?.status) {
      case "CONFIRMED":
        confirmed.push({
          candidate,
          alerts: confirmedAlerts(candidate, today),
        });
        break;
      case "ENDED":
        ended.push({
          candidate,
          alerts: endedAlerts(candidate, decision.decidedOn),
        });
        break;
      case "DISMISSED":
      case undefined:
        // A lapsed charge is most likely cancelled, so it is not worth deciding on.
        if (overdueDays(candidate, today) === null) {
          (decision ? dismissed : suggested).push(candidate);
        }
        break;
    }
  }

  const counted = confirmed.filter(({ alerts }) => !hasMissedCharge(alerts));
  const yearlyNok = roundNok(
    counted.reduce((sum, { candidate }) => sum + candidate.annualizedNok, 0),
  );

  return {
    confirmed,
    ended,
    suggested,
    dismissed,
    totals: {
      yearlyNok,
      monthlyNok: roundNok(yearlyNok / 12),
      excluded: confirmed
        .filter(({ alerts }) => hasMissedCharge(alerts))
        .map(({ candidate }) => candidate),
    },
  };
}

export function hasMissedCharge(alerts: readonly SubscriptionAlert[]): boolean {
  return alerts.some((alert) => alert.kind === "MISSED_CHARGE");
}

function confirmedAlerts(
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

function endedAlerts(
  candidate: RecurringCandidate,
  decidedOn: IsoDay,
): SubscriptionAlert[] {
  return daysBetween(decidedOn, candidate.lastChargeDate) > 0
    ? [{ kind: "CHARGED_AFTER_END", chargedOn: candidate.lastChargeDate }]
    : [];
}

/** Days past the expected charge, or null while still inside the grace window. */
function overdueDays(candidate: RecurringCandidate, today: IsoDay) {
  const days = daysBetween(candidate.nextExpectedDate, today);
  return days > CADENCES[candidate.cadence].graceDays ? days : null;
}

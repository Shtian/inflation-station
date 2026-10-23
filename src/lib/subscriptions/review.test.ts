import { describe, expect, it } from "vite-plus/test";
import type {
  Cadence,
  RecurringCandidate,
  SubscriptionDecisionStatus,
} from "./model";
import {
  recurringMerchants,
  reviewSubscriptions,
  type SubscriptionDecisions,
} from "./review";

function candidate(
  normalizedMerchant: string,
  cadence: Cadence,
  amounts: number[],
  dates: string[],
  nextExpectedDate: string,
  index = 0,
): RecurringCandidate {
  const current = amounts[amounts.length - 1];
  return {
    key: `${normalizedMerchant}|${cadence}|${index}`,
    normalizedMerchant,
    displayName: normalizedMerchant,
    cadence,
    charges: amounts.map((amountNok, i) => ({
      transactionId: `${normalizedMerchant}-${i}`,
      date: dates[i],
      amountNok,
    })),
    typicalAmountNok: amounts[0],
    currentAmountNok: current,
    annualizedNok: cadence === "MONTHLY" ? current * 12 : current,
    lastChargeDate: dates[dates.length - 1],
    nextExpectedDate,
  };
}

const JUL_AUG_SEP = ["2026-07-01", "2026-08-01", "2026-09-01"];

function monthly(merchant: string, amounts = [129, 129, 129], index = 0) {
  return candidate(
    merchant,
    "MONTHLY",
    amounts,
    JUL_AUG_SEP,
    "2026-10-01",
    index,
  );
}

function decisions(
  statuses: Record<string, SubscriptionDecisionStatus>,
): SubscriptionDecisions {
  return new Map(Object.entries(statuses));
}

const keysOf = (candidates: RecurringCandidate[]) =>
  candidates.map((entry) => entry.key);

describe("reviewSubscriptions", () => {
  it("partitions candidates by the decision on their merchant", () => {
    const review = reviewSubscriptions(
      [
        monthly("apple", [49, 49, 49], 0),
        monthly("apple", [129, 129, 129], 1),
        monthly("hbo"),
        monthly("netflix"),
        monthly("spotify"),
        monthly("viaplay"),
      ],
      decisions({
        netflix: "CONFIRMED",
        apple: "CONFIRMED",
        spotify: "DISMISSED",
        viaplay: "ENDED",
      }),
      "2026-09-15",
    );

    expect({
      confirmed: review.confirmed.map((entry) => entry.candidate.key),
      ended: review.ended.map((entry) => entry.candidate.key),
      suggested: keysOf(review.suggested),
      dismissed: keysOf(review.dismissed),
    }).toEqual({
      confirmed: ["apple|MONTHLY|0", "apple|MONTHLY|1", "netflix|MONTHLY|0"],
      ended: ["viaplay|MONTHLY|0"],
      suggested: ["hbo|MONTHLY|0"],
      dismissed: ["spotify|MONTHLY|0"],
    });
  });

  it("totals confirmed subscriptions per year and per month", () => {
    const review = reviewSubscriptions(
      [
        monthly("netflix", [129, 129, 129]),
        candidate(
          "forsikring",
          "YEARLY",
          [1200, 1200, 1200],
          ["2024-03-01", "2025-03-01", "2026-03-01"],
          "2027-03-01",
        ),
        monthly("hbo", [119, 119, 119]),
      ],
      decisions({ netflix: "CONFIRMED", forsikring: "CONFIRMED" }),
      "2026-09-15",
    );

    expect(review.totals).toEqual({
      yearlyNok: 2748,
      monthlyNok: 229,
      excluded: [],
    });
  });

  it("totals nothing when no subscription is confirmed", () => {
    const review = reviewSubscriptions(
      [monthly("hbo")],
      new Map(),
      "2026-09-15",
    );

    expect([review.totals, keysOf(review.suggested)]).toEqual([
      { yearlyNok: 0, monthlyNok: 0, excluded: [] },
      ["hbo|MONTHLY|0"],
    ]);
  });

  it("flags a price change beyond 1 kr and 1 percent on the latest charge", () => {
    const review = reviewSubscriptions(
      [
        monthly("spotify", [449, 449, 499]),
        monthly("hbo", [129, 129, 129.5]),
        monthly("strom", [2000, 2000, 2015]),
        monthly("leie", [2000, 2000, 2021]),
      ],
      decisions({
        spotify: "CONFIRMED",
        hbo: "CONFIRMED",
        strom: "CONFIRMED",
        leie: "CONFIRMED",
      }),
      "2026-09-15",
    );

    expect(
      review.confirmed.map((entry) => [
        entry.candidate.normalizedMerchant,
        entry.alerts,
      ]),
    ).toEqual([
      [
        "spotify",
        [
          {
            kind: "PRICE_CHANGE",
            fromNok: 449,
            toNok: 499,
            changedOn: "2026-09-01",
          },
        ],
      ],
      ["hbo", []],
      ["strom", []],
      [
        "leie",
        [
          {
            kind: "PRICE_CHANGE",
            fromNok: 2000,
            toNok: 2021,
            changedOn: "2026-09-01",
          },
        ],
      ],
    ]);
  });

  it("flags a missed monthly charge only after the 7-day grace window", () => {
    const confirmed = decisions({ netflix: "CONFIRMED" });
    const alertsOn = (today: string) =>
      reviewSubscriptions([monthly("netflix")], confirmed, today).confirmed[0]
        .alerts;

    expect(alertsOn("2026-10-08")).toEqual([]);
    expect(alertsOn("2026-10-09")).toEqual([
      { kind: "MISSED_CHARGE", expectedOn: "2026-10-01", daysOverdue: 8 },
    ]);
  });

  it("gives a yearly charge 30 days of grace", () => {
    const insurance = candidate(
      "forsikring",
      "YEARLY",
      [1200, 1200, 1200],
      ["2024-03-01", "2025-03-01", "2026-03-01"],
      "2027-03-01",
    );
    const confirmed = decisions({ forsikring: "CONFIRMED" });
    const alertsOn = (today: string) =>
      reviewSubscriptions([insurance], confirmed, today).confirmed[0].alerts;

    expect(alertsOn("2027-03-31")).toEqual([]);
    expect(alertsOn("2027-04-01")).toEqual([
      { kind: "MISSED_CHARGE", expectedOn: "2027-03-01", daysOverdue: 31 },
    ]);
  });

  it("stops suggesting a charge once it has lapsed past the grace window", () => {
    const suggestedOn = (today: string) =>
      keysOf(reviewSubscriptions([monthly("hbo")], new Map(), today).suggested);

    expect(suggestedOn("2026-10-08")).toEqual(["hbo|MONTHLY|0"]);
    expect(suggestedOn("2026-10-09")).toEqual([]);
  });

  it("leaves a confirmed subscription with a missed charge out of the totals", () => {
    const review = reviewSubscriptions(
      [
        monthly("netflix", [129, 129, 129]),
        candidate(
          "sats",
          "MONTHLY",
          [449, 449, 449],
          ["2026-06-29", "2026-07-29", "2026-08-29"],
          "2026-09-29",
        ),
      ],
      decisions({ netflix: "CONFIRMED", sats: "CONFIRMED" }),
      "2026-10-08",
    );

    expect({
      yearlyNok: review.totals.yearlyNok,
      monthlyNok: review.totals.monthlyNok,
      excluded: keysOf(review.totals.excluded),
    }).toEqual({
      yearlyNok: 1548,
      monthlyNok: 129,
      excluded: ["sats|MONTHLY|0"],
    });
  });

  it("never counts an ended subscription in the totals", () => {
    const review = reviewSubscriptions(
      [monthly("netflix", [129, 129, 129]), monthly("viaplay", [99, 99, 99])],
      decisions({ netflix: "CONFIRMED", viaplay: "ENDED" }),
      "2026-09-15",
    );

    expect(review.totals).toEqual({
      yearlyNok: 1548,
      monthlyNok: 129,
      excluded: [],
    });
  });

  it("flags an ended subscription that is charging on schedule again", () => {
    const review = reviewSubscriptions(
      [monthly("viaplay")],
      decisions({ viaplay: "ENDED" }),
      "2026-09-15",
    );

    expect(review.ended[0].alerts).toEqual([
      { kind: "CHARGED_AFTER_END", chargedOn: "2026-09-01" },
    ]);
  });

  it("keeps an ended subscription listed after its charges lapse", () => {
    const review = reviewSubscriptions(
      [monthly("viaplay"), monthly("hbo")],
      decisions({ viaplay: "ENDED", hbo: "DISMISSED" }),
      "2026-12-01",
    );

    expect({
      ended: review.ended.map((entry) => [entry.candidate.key, entry.alerts]),
      dismissed: keysOf(review.dismissed),
    }).toEqual({ ended: [["viaplay|MONTHLY|0", []]], dismissed: [] });
  });
});

describe("recurringMerchants", () => {
  it("keeps detected and decided-recurring merchants, dropping only dismissed ones", () => {
    const merchants = recurringMerchants(
      [monthly("netflix"), monthly("telenor"), monthly("fjordkraft")],
      decisions({
        telenor: "DISMISSED",
        fjordkraft: "ENDED",
        hbo: "CONFIRMED",
        viaplay: "ENDED",
        storytel: "DISMISSED",
      }),
    );

    expect([...merchants].sort()).toEqual([
      "fjordkraft",
      "hbo",
      "netflix",
      "viaplay",
    ]);
  });
});

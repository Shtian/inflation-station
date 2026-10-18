import { describe, expect, it } from "vitest";
import type { Cadence, RecurringCandidate } from "./model";
import { reviewSubscriptions, type SubscriptionDecisions } from "./review";

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

const keysOf = (candidates: RecurringCandidate[]) =>
  candidates.map((entry) => entry.key);

describe("reviewSubscriptions", () => {
  it("partitions candidates by the decision on their merchant", () => {
    const decisions: SubscriptionDecisions = new Map([
      ["netflix", "CONFIRMED"],
      ["apple", "CONFIRMED"],
      ["spotify", "DISMISSED"],
    ]);

    const review = reviewSubscriptions(
      [
        monthly("apple", [49, 49, 49], 0),
        monthly("apple", [129, 129, 129], 1),
        monthly("hbo"),
        monthly("netflix"),
        monthly("spotify"),
      ],
      decisions,
      "2026-09-15",
    );

    expect({
      confirmed: review.confirmed.map((entry) => entry.candidate.key),
      suggested: keysOf(review.suggested),
      dismissed: keysOf(review.dismissed),
    }).toEqual({
      confirmed: ["apple|MONTHLY|0", "apple|MONTHLY|1", "netflix|MONTHLY|0"],
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
      new Map([
        ["netflix", "CONFIRMED"],
        ["forsikring", "CONFIRMED"],
      ]),
      "2026-09-15",
    );

    expect(review.totals).toEqual({ yearlyNok: 2748, monthlyNok: 229 });
  });

  it("totals nothing when no subscription is confirmed", () => {
    const review = reviewSubscriptions(
      [monthly("hbo")],
      new Map(),
      "2026-09-15",
    );

    expect([review.totals, keysOf(review.suggested)]).toEqual([
      { yearlyNok: 0, monthlyNok: 0 },
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
      new Map([
        ["spotify", "CONFIRMED"],
        ["hbo", "CONFIRMED"],
        ["strom", "CONFIRMED"],
        ["leie", "CONFIRMED"],
      ]),
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
    const confirmed = new Map([["netflix", "CONFIRMED"] as const]);
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
    const confirmed = new Map([["forsikring", "CONFIRMED"] as const]);
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
});

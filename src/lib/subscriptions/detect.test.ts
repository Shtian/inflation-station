import { describe, expect, it } from "vitest";
import { detectRecurringCharges, type SubscriptionTransaction } from "./detect";

let nextId = 0;

function spend(
  merchant: string,
  bookingDate: string,
  amountNok: number,
  category: SubscriptionTransaction["category"] = null,
): SubscriptionTransaction {
  nextId += 1;
  return {
    id: `t${nextId}`,
    bookingDate,
    amountNok,
    normalizedMerchant: merchant.toLowerCase(),
    merchant,
    category,
  };
}

function summarize(transactions: SubscriptionTransaction[]) {
  return detectRecurringCharges(transactions).map((candidate) => [
    candidate.key,
    candidate.cadence,
    candidate.charges.map((charge) => charge.date),
  ]);
}

describe("detectRecurringCharges", () => {
  it("describes a clean monthly subscription", () => {
    const [first, second, third] = [
      spend("Netflix", "2026-06-15", -129),
      spend("Netflix", "2026-07-15", -129),
      spend("Netflix", "2026-08-14", -129),
    ];

    expect(detectRecurringCharges([third, first, second])).toEqual([
      {
        key: "netflix|MONTHLY|0",
        normalizedMerchant: "netflix",
        displayName: "Netflix",
        cadence: "MONTHLY",
        charges: [
          { transactionId: first.id, date: "2026-06-15", amountNok: 129 },
          { transactionId: second.id, date: "2026-07-15", amountNok: 129 },
          { transactionId: third.id, date: "2026-08-14", amountNok: 129 },
        ],
        typicalAmountNok: 129,
        currentAmountNok: 129,
        annualizedNok: 1548,
        lastChargeDate: "2026-08-14",
        nextExpectedDate: "2026-09-14",
      },
    ]);
  });

  it("describes a yearly subscription and annualizes it at one charge", () => {
    const [candidate] = detectRecurringCharges([
      spend("Forsikring", "2024-03-01", -1200),
      spend("Forsikring", "2025-03-01", -1200),
      spend("Forsikring", "2026-03-02", -1250),
    ]);

    expect([
      candidate.cadence,
      candidate.currentAmountNok,
      candidate.annualizedNok,
      candidate.nextExpectedDate,
    ]).toEqual(["YEARLY", 1250, 1250, "2027-03-02"]);
  });

  it("keeps a price increase within the tolerance as one subscription", () => {
    const candidates = detectRecurringCharges([
      spend("Spotify", "2026-05-02", -449),
      spend("Spotify", "2026-06-02", -449),
      spend("Spotify", "2026-07-02", -449),
      spend("Spotify", "2026-08-02", -499),
    ]);

    expect(
      candidates.map((candidate) => [
        candidate.key,
        candidate.typicalAmountNok,
        candidate.currentAmountNok,
        candidate.annualizedNok,
        candidate.charges.length,
      ]),
    ).toEqual([["spotify|MONTHLY|0", 449, 499, 5988, 4]]);
  });

  it("accepts one skipped month but not a mostly two-monthly pattern", () => {
    expect(
      summarize([
        spend("Gym", "2026-01-10", -399),
        spend("Gym", "2026-02-10", -399),
        spend("Gym", "2026-04-10", -399),
        spend("Gym", "2026-05-10", -399),
        spend("Avis", "2026-01-10", -99),
        spend("Avis", "2026-03-10", -99),
        spend("Avis", "2026-05-10", -99),
        spend("Avis", "2026-06-10", -99),
      ]),
    ).toEqual([
      [
        "gym|MONTHLY|0",
        "MONTHLY",
        ["2026-01-10", "2026-02-10", "2026-04-10", "2026-05-10"],
      ],
    ]);
  });

  it("splits two subscriptions at one merchant by amount", () => {
    const candidates = detectRecurringCharges([
      spend("Apple", "2026-06-03", -49),
      spend("Apple", "2026-06-20", -129),
      spend("Apple", "2026-07-03", -49),
      spend("Apple", "2026-07-20", -129),
      spend("Apple", "2026-08-03", -49),
      spend("Apple", "2026-08-20", -129),
    ]);

    expect(
      candidates.map((candidate) => [
        candidate.key,
        candidate.currentAmountNok,
        candidate.nextExpectedDate,
      ]),
    ).toEqual([
      ["apple|MONTHLY|0", 49, "2026-09-03"],
      ["apple|MONTHLY|1", 129, "2026-09-20"],
    ]);
  });

  it("rejects irregular amounts or irregular dates at a merchant", () => {
    expect(
      summarize([
        spend("Rema", "2026-06-01", -312),
        spend("Rema", "2026-07-01", -87),
        spend("Rema", "2026-08-01", -540),
        spend("Kiosk", "2026-01-03", -99),
        spend("Kiosk", "2026-01-20", -99),
        spend("Kiosk", "2026-02-28", -99),
        spend("Kiosk", "2026-04-02", -99),
        spend("Hbo", "2026-06-05", -119),
        spend("Hbo", "2026-07-05", -119),
        spend("Hbo", "2026-08-05", -119),
      ]),
    ).toEqual([
      ["hbo|MONTHLY|0", "MONTHLY", ["2026-06-05", "2026-07-05", "2026-08-05"]],
    ]);
  });

  it("needs at least three charges", () => {
    expect(
      summarize([
        spend("Viaplay", "2026-07-05", -449),
        spend("Viaplay", "2026-08-05", -449),
        spend("Hbo", "2026-06-05", -119),
        spend("Hbo", "2026-07-05", -119),
        spend("Hbo", "2026-08-05", -119),
      ]).map(([key]) => key),
    ).toEqual(["hbo|MONTHLY|0"]);
  });

  it("rejects a same-day duplicate charge", () => {
    expect(
      summarize([
        spend("Viaplay", "2026-06-05", -449),
        spend("Viaplay", "2026-07-05", -449),
        spend("Viaplay", "2026-07-05", -449),
        spend("Viaplay", "2026-08-05", -449),
      ]),
    ).toEqual([]);
  });

  it("counts uncategorized spending but ignores transfers and income", () => {
    const transfer = { kind: "TRANSFER" };
    const groceries = { kind: "EXPENSE" };

    expect(
      summarize([
        spend("Sparekonto", "2026-06-25", -2000, transfer),
        spend("Sparekonto", "2026-07-25", -2000, transfer),
        spend("Sparekonto", "2026-08-25", -2000, transfer),
        spend("Lonn", "2026-06-20", 42000),
        spend("Lonn", "2026-07-20", 42000),
        spend("Lonn", "2026-08-20", 42000),
        spend("Strom", "2026-06-10", -650, groceries),
        spend("Strom", "2026-07-10", -640, groceries),
        spend("Strom", "2026-08-10", -660, groceries),
        spend("Netflix", "2026-06-15", -129),
        spend("Netflix", "2026-07-15", -129),
        spend("Netflix", "2026-08-15", -129),
      ]).map(([key]) => key),
    ).toEqual(["netflix|MONTHLY|0", "strom|MONTHLY|0"]);
  });
});

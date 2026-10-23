import { describe, expect, it } from "vite-plus/test";
import type { RecurringCandidate } from "@/lib/subscriptions/model";
import {
  describeAlert,
  describeExcludedFromTotals,
  describeYearlyImpact,
  formatAmount,
} from "./format";

const normalizeSpaces = (value: string) => value.replaceAll(/\s/g, " ");

const sats: RecurringCandidate = {
  key: "sats|MONTHLY|0",
  normalizedMerchant: "sats",
  displayName: "SATS",
  cadence: "MONTHLY",
  charges: [],
  typicalAmountNok: 449,
  currentAmountNok: 449,
  annualizedNok: 5388,
  lastChargeDate: "2026-08-29",
  nextExpectedDate: "2026-09-29",
};

describe("describeAlert", () => {
  it("shows a price change with the month it took effect", () => {
    expect(
      normalizeSpaces(
        describeAlert(
          {
            kind: "PRICE_CHANGE",
            fromNok: 449,
            toNok: 499,
            changedOn: "2026-10-02",
          },
          sats,
        ),
      ),
    ).toBe("449 kr → 499 kr fra oktober 2026");
  });

  it("names the last charge before the missing one", () => {
    expect(
      normalizeSpaces(
        describeAlert(
          { kind: "MISSED_CHARGE", expectedOn: "2026-09-29", daysOverdue: 9 },
          sats,
        ),
      ),
    ).toBe("ikke trukket siden 29. aug. 2026");
  });

  it("names the charge that arrived after the subscription ended", () => {
    expect(
      normalizeSpaces(
        describeAlert(
          { kind: "CHARGED_AFTER_END", chargedOn: "2026-10-03" },
          sats,
        ),
      ),
    ).toBe("trukket igjen 3. okt. 2026 etter at du avsluttet");
  });
});

describe("describeYearlyImpact", () => {
  it("annualizes a price change by the cadence", () => {
    const priceChange = (fromNok: number, toNok: number) =>
      ({
        kind: "PRICE_CHANGE",
        fromNok,
        toNok,
        changedOn: "2026-10-02",
      }) as const;

    expect(
      [
        describeYearlyImpact(priceChange(119, 129), sats),
        describeYearlyImpact(priceChange(1200, 1100), {
          ...sats,
          cadence: "YEARLY",
        }),
        describeYearlyImpact(
          { kind: "MISSED_CHARGE", expectedOn: "2026-09-29", daysOverdue: 9 },
          sats,
        ),
      ].map((value) => value && normalizeSpaces(value)),
    ).toEqual(["+120 kr/år", "−100 kr/år", null]);
  });
});

describe("describeExcludedFromTotals", () => {
  it("names a single excluded subscription and counts several", () => {
    expect(
      [
        describeExcludedFromTotals([]),
        describeExcludedFromTotals([sats]),
        describeExcludedFromTotals([sats, { ...sats, displayName: "Viaplay" }]),
      ].map((value) => value && normalizeSpaces(value)),
    ).toEqual([
      null,
      "Ekskl. SATS, som ikke er trukket siden 29. aug. 2026.",
      "Ekskl. 2 faste trekk som ikke er trukket som forventet.",
    ]);
  });
});

describe("formatAmount", () => {
  it("drops øre only when there are none", () => {
    expect(
      [formatAmount(5988), formatAmount(149.9)].map(normalizeSpaces),
    ).toEqual(["5 988 kr", "149,90 kr"]);
  });
});

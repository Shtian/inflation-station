import { describe, expect, it } from "vitest";
import {
  describeAlert,
  formatAmount,
  merchantTransactionsHref,
} from "./format";

const normalizeSpaces = (value: string) => value.replaceAll(/\s/g, " ");

describe("describeAlert", () => {
  it("shows a price change with the month it took effect", () => {
    expect(
      normalizeSpaces(
        describeAlert({
          kind: "PRICE_CHANGE",
          fromNok: 449,
          toNok: 499,
          changedOn: "2026-10-02",
        }),
      ),
    ).toBe("449 kr → 499 kr fra oktober 2026");
  });

  it("names the charge date that never arrived", () => {
    expect(
      normalizeSpaces(
        describeAlert({
          kind: "MISSED_CHARGE",
          expectedOn: "2026-10-01",
          daysOverdue: 9,
        }),
      ),
    ).toBe("Forventet trekk 1. okt. 2026 mangler");
  });
});

describe("formatAmount", () => {
  it("drops øre only when there are none", () => {
    expect(
      [formatAmount(5988), formatAmount(149.9)].map(normalizeSpaces),
    ).toEqual(["5 988 kr", "149,90 kr"]);
  });
});

describe("merchantTransactionsHref", () => {
  it("searches transactions by the merchant key", () => {
    expect(merchantTransactionsHref("apple com bill")).toBe(
      "/transactions?globalQuery=apple+com+bill",
    );
  });
});

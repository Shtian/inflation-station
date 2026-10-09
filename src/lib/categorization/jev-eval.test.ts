import { describe, expect, it } from "vitest";
import { emptyJevOutcomeSummary } from "./jev-categorize";
import {
  buildJevEvalCases,
  formatJevEvalReport,
  type JevEvalCase,
  type JevEvalResult,
  singleRowOutcome,
} from "./jev-eval";

function evalCase(name: string, expectedCategoryId: string): JevEvalCase {
  return {
    normalizedMerchant: name.toLowerCase(),
    expectedCategoryId,
    row: {
      rowNumber: 1,
      bookingDate: "2026-09-01",
      amountNok: -100,
      currency: "NOK",
      paymentType: "CARD",
      sender: "",
      recipient: "",
      name,
      title: "",
    },
  };
}

const categories = [
  { id: "groceries", name: "Dagligvarer", classifierHint: null },
  { id: "dining", name: "Restaurant & Takeaway", classifierHint: null },
  { id: "transport", name: "Transport", classifierHint: null },
];

describe("buildJevEvalCases", () => {
  it("keeps the first transaction per merchant, caps at the limit and builds the row Jev sees", () => {
    const transaction = {
      bookingDate: new Date("2026-09-03T00:00:00.000Z"),
      amountNok: -89.9,
      currency: "NOK",
      paymentType: "CARD" as const,
    };

    const cases = buildJevEvalCases(
      [
        {
          ...transaction,
          normalizedMerchant: "rema 1000",
          merchant: "REMA 1000",
          categoryId: "groceries",
        },
        {
          ...transaction,
          normalizedMerchant: "rema 1000",
          merchant: "REMA 1000 STORO",
          categoryId: "dining",
        },
        {
          ...transaction,
          normalizedMerchant: "ruter",
          merchant: null,
          categoryId: "transport",
        },
        {
          ...transaction,
          normalizedMerchant: "meny",
          merchant: "MENY",
          categoryId: "groceries",
        },
      ],
      2,
    );

    expect(cases).toEqual([
      {
        normalizedMerchant: "rema 1000",
        expectedCategoryId: "groceries",
        row: {
          rowNumber: 1,
          bookingDate: "2026-09-03",
          amountNok: -89.9,
          currency: "NOK",
          paymentType: "CARD",
          sender: "",
          recipient: "",
          name: "REMA 1000",
          title: "",
        },
      },
      {
        normalizedMerchant: "ruter",
        expectedCategoryId: "transport",
        row: {
          rowNumber: 2,
          bookingDate: "2026-09-03",
          amountNok: -89.9,
          currency: "NOK",
          paymentType: "CARD",
          sender: "",
          recipient: "",
          name: "ruter",
          title: "",
        },
      },
    ]);
  });
});

describe("singleRowOutcome", () => {
  it("returns the one outcome a single-row run counted", () => {
    expect(
      singleRowOutcome({ ...emptyJevOutcomeSummary(), below_floor: 1 }),
    ).toBe("below_floor");
  });

  it("rejects a summary that does not describe exactly one row", () => {
    expect(() => singleRowOutcome(emptyJevOutcomeSummary())).toThrow(
      "Expected exactly one row outcome, got 0",
    );
    expect(() =>
      singleRowOutcome({ ...emptyJevOutcomeSummary(), ok: 1, timeout: 1 }),
    ).toThrow("Expected exactly one row outcome, got 2");
  });
});

describe("formatJevEvalReport", () => {
  it("counts every outcome and lists wrong and missed rows", () => {
    const cases = [
      evalCase("REMA 1000", "groceries"),
      evalCase("MENY BOGSTADVEIEN", "groceries"),
      evalCase("RUTER AS", "transport"),
      evalCase("SANTANDER", "transport"),
      evalCase("KIWI", "groceries"),
    ];
    const results: JevEvalResult[] = [
      {
        outcome: "ok",
        suggestion: { categoryId: "groceries", confidence: 0.91 },
        latencyMs: 240,
      },
      {
        outcome: "ok",
        suggestion: { categoryId: "dining", confidence: 0.987 },
        latencyMs: 310,
      },
      { outcome: "uncategorized", suggestion: null, latencyMs: 200 },
      { outcome: "below_floor", suggestion: null, latencyMs: 280 },
      { outcome: "timeout", suggestion: null, latencyMs: 5004 },
    ];

    expect(formatJevEvalReport({ cases, results, categories })).toBe(
      [
        "Jev categorization eval: 5 cases, 3 categories",
        "",
        "suggested           2",
        "  correct           1",
        "  wrong             1",
        "uncategorized       1",
        "below_floor         1",
        "unavailable         1",
        "  disabled          0",
        "  key_missing       0",
        "  timeout           1",
        "  provider_error    0",
        "latency p50       280 ms",
        "latency max      5004 ms",
        "",
        "Wrong or missed (4):",
        "  MENY BOGSTADVEIEN  wanted Dagligvarer  picked Restaurant & Takeaway  confidence 0.99",
        "  RUTER AS           wanted Transport    picked (uncategorized)        confidence -",
        "  SANTANDER          wanted Transport    picked (below_floor)          confidence -",
        "  KIWI               wanted Dagligvarer  picked (timeout)              confidence -",
      ].join("\n"),
    );
  });

  it("reports an empty run without latency figures", () => {
    expect(formatJevEvalReport({ cases: [], results: [], categories })).toBe(
      [
        "Jev categorization eval: 0 cases, 3 categories",
        "",
        "suggested           0",
        "  correct           0",
        "  wrong             0",
        "uncategorized       0",
        "below_floor         0",
        "unavailable         0",
        "  disabled          0",
        "  key_missing       0",
        "  timeout           0",
        "  provider_error    0",
        "latency p50         - ms",
        "latency max         - ms",
        "",
        "Wrong or missed (0):",
      ].join("\n"),
    );
  });
});

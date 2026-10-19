import { describe, expect, it } from "vitest";
import {
  membershipChangeFor,
  summarizeTrip,
  type Trip,
  type TripTransaction,
  toTripCandidate,
  toTripListItem,
} from "./summary";

const LISBOA: Trip = {
  id: "lisboa",
  name: "Lisboa",
  startDate: "2026-05-01",
  endDate: "2026-05-05",
};

function row(
  id: string,
  bookingDate: string,
  amountNok: number,
  category: TripTransaction["category"],
  trip: TripTransaction["trip"] = { id: "lisboa", name: "Lisboa" },
): TripTransaction {
  return { id, bookingDate, amountNok, merchant: id, category, trip };
}

const travel = { name: "Reise", kind: "EXPENSE" } as const;
const lodging = { name: "Overnatting", kind: "EXPENSE" } as const;
const dining = { name: "Restaurant", kind: "EXPENSE" } as const;
const transfer = { name: "Overføring", kind: "TRANSFER" } as const;
const salary = { name: "Lønn", kind: "INCOME" } as const;

const MEMBERS = [
  row("middag", "2026-05-02", -650.5, dining),
  row("fly", "2026-03-10", -2400, travel),
  row("refusjon", "2026-05-06", 500, lodging),
  row("overforing", "2026-05-01", -1000, transfer),
  row("hotell", "2026-04-02", -3000, lodging),
  row("lunsj", "2026-05-03", -349.5, dining),
  row("kiosk", "2026-05-01", -100, null),
];

describe("summarizeTrip", () => {
  it("nets refunds, skips transfers and spreads the cost over the inclusive days", () => {
    const summary = summarizeTrip(LISBOA, MEMBERS);

    expect({
      days: summary.days,
      costNok: summary.costNok,
      perDayNok: summary.perDayNok,
    }).toEqual({ days: 5, costNok: 6000, perDayNok: 1200 });
  });

  it("breaks the cost down by category, highest first, with uncategorized as Ukategorisert", () => {
    expect(summarizeTrip(LISBOA, MEMBERS).byCategory).toEqual([
      { categoryName: "Overnatting", costNok: 2500 },
      { categoryName: "Reise", costNok: 2400 },
      { categoryName: "Restaurant", costNok: 1000 },
      { categoryName: "Ukategorisert", costNok: 100 },
    ]);
  });

  it("splits members on the start date, oldest first, keeping transfers and rows after the end", () => {
    const summary = summarizeTrip(LISBOA, MEMBERS);

    expect(summary.beforeTrip.map((member) => member.id)).toEqual([
      "fly",
      "hotell",
    ]);
    expect(summary.duringTrip.map((member) => member.id)).toEqual([
      "kiosk",
      "overforing",
      "middag",
      "lunsj",
      "refusjon",
    ]);
  });

  it("drops a category whose refund cancels it and rounds to øre", () => {
    const summary = summarizeTrip(
      {
        id: "t",
        name: "Bergen",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
      },
      [
        row("bil", "2026-06-01", -800, { name: "Leiebil", kind: "EXPENSE" }),
        row("bil-retur", "2026-06-03", 800, {
          name: "Leiebil",
          kind: "EXPENSE",
        }),
        row("kaffe", "2026-06-01", -0.1, dining),
        row("bolle", "2026-06-02", -0.2, dining),
        row("tog", "2026-06-02", -999.7, travel),
      ],
    );

    expect(summary.byCategory).toEqual([
      { categoryName: "Reise", costNok: 999.7 },
      { categoryName: "Restaurant", costNok: 0.3 },
    ]);
    expect(summary.costNok).toBe(1000);
    expect(summary.perDayNok).toBe(333.33);
  });

  it("reads an empty one-day trip as zero kroner over one day", () => {
    const summary = summarizeTrip(
      {
        id: "t",
        name: "Dagstur",
        startDate: "2026-07-04",
        endDate: "2026-07-04",
      },
      [],
    );

    expect(summary).toEqual({
      id: "t",
      name: "Dagstur",
      startDate: "2026-07-04",
      endDate: "2026-07-04",
      days: 1,
      costNok: 0,
      perDayNok: 0,
      byCategory: [],
      beforeTrip: [],
      duringTrip: [],
    });
  });
});

describe("toTripListItem", () => {
  it("lists the same totals the detail page shows, plus the member count", () => {
    expect(toTripListItem(LISBOA, MEMBERS)).toEqual({
      id: "lisboa",
      name: "Lisboa",
      startDate: "2026-05-01",
      endDate: "2026-05-05",
      days: 5,
      costNok: 6000,
      perDayNok: 1200,
      transactionCount: 7,
    });
  });
});

describe("toTripCandidate", () => {
  const other = { id: "roma", name: "Roma" };

  it.each([
    ["already on this trip, even income", salary, 500, LISBOA, true],
    ["on another trip", travel, -100, other, false],
    ["untagged expense", travel, -100, null, true],
    ["untagged income", salary, 500, null, false],
    ["untagged transfer", transfer, -100, null, false],
    ["untagged uncategorized spend", null, -100, null, true],
    ["untagged uncategorized refund", null, 100, null, false],
  ] as const)("suggesting, %s -> checked: %s", (_label, category, amountNok, trip, expected) => {
    const candidate = toTripCandidate(
      "lisboa",
      row(
        "x",
        "2026-05-02",
        amountNok,
        category,
        trip && { id: trip.id, name: trip.name },
      ),
      "suggest",
    );

    expect(candidate.defaultChecked).toBe(expected);
  });

  it("shows stored membership once the trip is curated, so left-out spending stays out", () => {
    const candidates = [
      row("member", "2026-05-02", -100, travel),
      row("left-out-rent", "2026-05-01", -12000, lodging, null),
      row("uncategorized", "2026-05-02", -50, null, null),
    ].map((transaction) => toTripCandidate("lisboa", transaction, "stored"));

    expect(
      candidates.map((candidate) => [candidate.id, candidate.defaultChecked]),
    ).toEqual([
      ["member", true],
      ["left-out-rent", false],
      ["uncategorized", false],
    ]);
  });
});

describe("membershipChangeFor", () => {
  it("adds checked rows not on the trip and removes unchecked rows that are", () => {
    const roma = { id: "roma", name: "Roma" };
    const candidates = [
      row("kept", "2026-05-01", -1, travel),
      row("unchecked-member", "2026-05-01", -1, travel),
      row("new", "2026-05-01", -1, travel, null),
      row("moved", "2026-05-01", -1, travel, roma),
      row("left-alone", "2026-05-01", -1, travel, null),
      row("other-trip-unchecked", "2026-05-01", -1, travel, roma),
    ].map((transaction) => toTripCandidate("lisboa", transaction, "stored"));

    expect(
      membershipChangeFor(
        "lisboa",
        candidates,
        new Set(["kept", "new", "moved"]),
      ),
    ).toEqual({
      tripId: "lisboa",
      add: ["new", "moved"],
      remove: ["unchecked-member"],
    });
  });
});

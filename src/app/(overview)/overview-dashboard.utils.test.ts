import { describe, expect, it } from "vite-plus/test";
import {
  formatDashboardPeriod,
  fromDateInputValue,
  parseDashboardPeriod,
  previousMonth,
  resolveDashboardPeriod,
} from "./overview-dashboard.utils";

const OCTOBER_23_2026 = new Date(2026, 9, 23, 12);

describe("resolveDashboardPeriod", () => {
  it.each([
    [2024, 2, "2024-02-01", "2024-02-29"],
    [2026, 2, "2026-02-01", "2026-02-28"],
    [2026, 4, "2026-04-01", "2026-04-30"],
    [2026, 12, "2026-12-01", "2026-12-31"],
    [2026, 1, "2026-01-01", "2026-01-31"],
  ])(
    "resolves %i-%i to its first through last day",
    (year, month, startDate, endDate) => {
      expect(
        resolveDashboardPeriod({ kind: "month", year, month }, OCTOBER_23_2026),
      ).toEqual({ startDate, endDate });
    },
  );

  it("resolves the last 30 days as today and the 29 days before it", () => {
    expect(
      resolveDashboardPeriod(
        { kind: "rolling", preset: "30d" },
        new Date(2026, 1, 20, 12),
      ),
    ).toEqual({ startDate: "2026-01-22", endDate: "2026-02-20" });
  });

  it("resolves year to date from January 1", () => {
    expect(
      resolveDashboardPeriod(
        { kind: "rolling", preset: "ytd" },
        OCTOBER_23_2026,
      ),
    ).toEqual({ startDate: "2026-01-01", endDate: "2026-10-23" });
  });

  it("returns a custom range as given", () => {
    expect(
      resolveDashboardPeriod(
        { kind: "custom", startDate: "2026-09-05", endDate: "2026-10-18" },
        OCTOBER_23_2026,
      ),
    ).toEqual({ startDate: "2026-09-05", endDate: "2026-10-18" });
  });
});

describe("previousMonth", () => {
  it("steps back within the same year", () => {
    expect(previousMonth(OCTOBER_23_2026)).toEqual({
      kind: "month",
      year: 2026,
      month: 9,
    });
  });

  it("steps from January back to December of the previous year", () => {
    expect(previousMonth(new Date(2026, 0, 1, 12))).toEqual({
      kind: "month",
      year: 2025,
      month: 12,
    });
  });
});

describe("dashboard period URL codec", () => {
  it.each([
    ["2026-09", { kind: "month", year: 2026, month: 9 }],
    ["30d", { kind: "rolling", preset: "30d" }],
    ["90d", { kind: "rolling", preset: "90d" }],
    ["ytd", { kind: "rolling", preset: "ytd" }],
    [
      "2026-09-05..2026-10-18",
      { kind: "custom", startDate: "2026-09-05", endDate: "2026-10-18" },
    ],
    [
      "2026-09-05..2026-09-05",
      { kind: "custom", startDate: "2026-09-05", endDate: "2026-09-05" },
    ],
  ])("parses %s and formats it back", (value, period) => {
    const parsed = parseDashboardPeriod(value);
    expect(parsed).toEqual(period);
    expect(parsed && formatDashboardPeriod(parsed)).toBe(value);
  });

  it.each([
    "2026-13",
    "2026-00",
    "2026-9",
    "2026-02-31..2026-03-01",
    "2026-10-18..2026-09-05",
    "2026-09-05..",
    "2026-09-05..2026-09-06..2026-09-07",
    "garbage",
    "",
    undefined,
    42,
  ])("rejects %j", (value) => {
    expect(parseDashboardPeriod(value)).toBeNull();
  });
});

describe("fromDateInputValue", () => {
  it("parses a real calendar day", () => {
    expect(fromDateInputValue("2026-02-28")?.toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
  });

  it("rejects a day that does not exist in its month instead of rolling it over", () => {
    expect(fromDateInputValue("2026-02-31")).toBeUndefined();
    expect(fromDateInputValue("2026-04-31")).toBeUndefined();
  });

  it("rejects the leap day of a common year", () => {
    expect(fromDateInputValue("2025-02-29")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(fromDateInputValue("")).toBeUndefined();
  });
});

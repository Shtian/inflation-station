import { describe, expect, it } from "vitest";
import {
  describeMembershipChange,
  describePendingChange,
  describeSelection,
  formatAmount,
  formatDays,
  formatTripRange,
} from "./format";

const NBSP = / /g;

function plain(value: string): string {
  return value.replace(NBSP, " ").replace(/ /g, " ");
}

describe("trip formatting", () => {
  it("collapses a range inside one month and spells out one that spans two", () => {
    expect(plain(formatTripRange("2026-05-01", "2026-05-05"))).toBe(
      "1.–5. mai 2026",
    );
    expect(plain(formatTripRange("2026-04-28", "2026-05-03"))).toBe(
      "28. apr.–3. mai 2026",
    );
    expect(plain(formatTripRange("2026-07-04", "2026-07-04"))).toBe(
      "4. juli 2026",
    );
  });

  it("pluralises days", () => {
    expect([formatDays(1), formatDays(5)]).toEqual(["1 dag", "5 dager"]);
  });

  it("drops øre only when there are none", () => {
    expect(plain(formatAmount(6000))).toBe("6 000 kr");
    expect(plain(formatAmount(333.33))).toBe("333,33 kr");
  });

  it("describes what a membership change did", () => {
    expect(
      [
        { added: 2, removed: 1 },
        { added: 3, removed: 0 },
        { added: 0, removed: 1 },
        { added: 0, removed: 0 },
      ].map(describeMembershipChange),
    ).toEqual([
      "2 lagt til og 1 fjernet fra turen.",
      "3 lagt til i turen.",
      "1 fjernet fra turen.",
      "Ingen endringer.",
    ]);
  });

  it("sums up the checked rows with their cost", () => {
    expect(describeSelection(4, 1988.65)).toMatch(/^4 valgt · 1\s988,65\skr$/);
    expect(describeSelection(2, 1000)).toMatch(/^2 valgt · 1\s000\skr$/);
    expect(describeSelection(0, 0)).toMatch(/^0 valgt · 0\skr$/);
  });

  it("shows what saving would add and remove", () => {
    expect(
      [
        { add: 2, remove: 1 },
        { add: 2, remove: 0 },
        { add: 0, remove: 1 },
        { add: 0, remove: 0 },
      ].map(describePendingChange),
    ).toEqual(["+2 / −1", "+2", "−1", ""]);
  });
});

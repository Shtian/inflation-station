import { afterEach, describe, expect, it, vi } from "vitest";
import { fromDateInputValue, getPresetRange } from "./overview-dashboard.utils";

describe("overview dashboard date presets", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps 30-day range deterministic against the current day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T12:00:00.000Z"));

    expect(getPresetRange("30d")).toEqual({
      startDate: "2026-01-22",
      endDate: "2026-02-20",
    });
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

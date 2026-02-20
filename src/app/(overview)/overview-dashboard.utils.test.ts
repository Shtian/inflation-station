import { afterEach, describe, expect, it, vi } from "vitest";
import { getPresetRange } from "./overview-dashboard.utils";

describe("overview dashboard date presets", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an unbounded range for the all-time preset", () => {
    expect(getPresetRange("all")).toEqual({
      startDate: "",
      endDate: "",
    });
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

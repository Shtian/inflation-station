import { describe, expect, it } from "vitest";
import {
  formatDayLong,
  formatMonthName,
  keepAmountsTogether,
  toMonthDateRange,
} from "./month-in-review.format";

describe("month in review formatting", () => {
  it("writes dates day-first with the day glued to the month", () => {
    expect(formatDayLong("2026-09-01")).toBe("Tuesday 1 September");
    expect(formatDayLong("2026-03-14")).toBe("Saturday 14 March");
  });

  it("names the month without the year", () => {
    expect(formatMonthName("2026-08-01")).toBe("August");
  });

  it("covers the whole month, leap years included", () => {
    expect(toMonthDateRange("2028-02-01")).toEqual({
      dateFrom: "2028-02-01",
      dateTo: "2028-02-29",
    });
    expect(toMonthDateRange("2026-12-01")).toEqual({
      dateFrom: "2026-12-01",
      dateTo: "2026-12-31",
    });
  });

  it("keeps amounts in a recap from wrapping mid-number", () => {
    expect(
      keepAmountsTogether(
        "endte på ca. 2 800 kr, og 5 000 kr til sparing i 2026 og 12 måneder",
      ),
    ).toBe(
      "endte på ca. 2\u00a0800\u00a0kr, og 5\u00a0000\u00a0kr til sparing i 2026 og 12 måneder",
    );
  });
});

import { describe, expect, it } from "vitest";
import { parseIsoDate } from "./iso-date";

describe("parseIsoDate", () => {
  it("returns midnight UTC for a real calendar day", () => {
    expect(parseIsoDate("2026-01-01")?.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(parseIsoDate("2026-02-28")?.toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
    expect(parseIsoDate("2026-12-31")?.toISOString()).toBe(
      "2026-12-31T00:00:00.000Z",
    );
  });

  it("accepts the leap day of a leap year", () => {
    expect(parseIsoDate("2024-02-29")?.toISOString()).toBe(
      "2024-02-29T00:00:00.000Z",
    );
  });

  it("rejects a day that does not exist in its month", () => {
    expect(parseIsoDate("2026-02-31")).toBeNull();
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("2026-04-31")).toBeNull();
    expect(parseIsoDate("2026-04-30")?.toISOString()).toBe(
      "2026-04-30T00:00:00.000Z",
    );
  });

  it("rejects the leap day of a common year", () => {
    expect(parseIsoDate("2025-02-29")).toBeNull();
    expect(parseIsoDate("2025-02-28")?.toISOString()).toBe(
      "2025-02-28T00:00:00.000Z",
    );
  });

  it("rejects a month outside 01-12", () => {
    expect(parseIsoDate("2026-13-01")).toBeNull();
    expect(parseIsoDate("2026-00-10")).toBeNull();
    expect(parseIsoDate("2026-12-01")?.toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });

  it("rejects input that is not a YYYY-MM-DD string", () => {
    expect(parseIsoDate("banana")).toBeNull();
    expect(parseIsoDate("2026/01/01")).toBeNull();
    expect(parseIsoDate("2026-1-1")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("2026-01-01T00:00:00.000Z")).toBeNull();
    expect(parseIsoDate("2026-01-01")?.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });
});

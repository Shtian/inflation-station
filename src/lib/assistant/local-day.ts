import { parseIsoDate } from "@/lib/iso-date";

function toLocalStart(isoDate: string, field: string): Date {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    throw new Error(
      `Invalid ${field} date "${isoDate}". Expected an existing calendar day as YYYY-MM-DD.`,
    );
  }
  return new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  );
}

export function toLocalDayBounds(range: { from?: string; to?: string }): {
  start: Date | undefined;
  end: Date | undefined;
} {
  const start =
    range.from !== undefined ? toLocalStart(range.from, "from") : undefined;
  const toStart =
    range.to !== undefined ? toLocalStart(range.to, "to") : undefined;
  if (start && toStart && start > toStart) {
    throw new Error(
      `Invalid range: from (${range.from}) is after to (${range.to}).`,
    );
  }
  const end = toStart
    ? new Date(toStart.getFullYear(), toStart.getMonth(), toStart.getDate() + 1)
    : undefined;
  return { start, end };
}

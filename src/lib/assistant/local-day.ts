import { parseIsoDate } from "@/lib/iso-date";

function toLocalStart(isoDate: string, label: string): Date {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    throw new Error(
      `Ugyldig ${label} "${isoDate}". Bruk en dag som finnes i kalenderen, på formen YYYY-MM-DD.`,
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
    range.from !== undefined
      ? toLocalStart(range.from, "startdato")
      : undefined;
  const toStart =
    range.to !== undefined ? toLocalStart(range.to, "sluttdato") : undefined;
  if (start && toStart && start > toStart) {
    throw new Error(
      `Ugyldig periode: startdatoen (${range.from}) er etter sluttdatoen (${range.to}).`,
    );
  }
  const end = toStart
    ? new Date(toStart.getFullYear(), toStart.getMonth(), toStart.getDate() + 1)
    : undefined;
  return { start, end };
}

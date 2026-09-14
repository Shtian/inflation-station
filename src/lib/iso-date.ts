export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const yearNumber = Number.parseInt(year, 10);
  const monthNumber = Number.parseInt(month, 10);
  const dayNumber = Number.parseInt(day, 10);
  const parsed = new Date(
    Date.UTC(yearNumber, monthNumber - 1, dayNumber, 0, 0, 0, 0),
  );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== yearNumber ||
    parsed.getUTCMonth() !== monthNumber - 1 ||
    parsed.getUTCDate() !== dayNumber
  ) {
    return null;
  }

  return parsed;
}

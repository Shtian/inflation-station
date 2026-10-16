const timeFormat = new Intl.DateTimeFormat("nb-NO", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
});
const fullDateFormat = new Intl.DateTimeFormat("nb-NO", { dateStyle: "short" });

export function formatThreadDate(date: Date, now: Date): string {
  if (date.toDateString() === now.toDateString()) {
    return timeFormat.format(date);
  }
  if (date.getFullYear() === now.getFullYear()) {
    return dayFormat.format(date);
  }
  return fullDateFormat.format(date);
}

// MonthlyReview.monthStart is UTC midnight on the 1st, whatever the server's
// time zone. Transactions are bucketed by local calendar month instead, so a
// review row must never be keyed with local getters.
export function toReviewMonthStartDate(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

export function toReviewMonthKey(monthStart: Date): string {
  const month = `${monthStart.getUTCMonth() + 1}`.padStart(2, "0");
  return `${monthStart.getUTCFullYear()}-${month}-01`;
}

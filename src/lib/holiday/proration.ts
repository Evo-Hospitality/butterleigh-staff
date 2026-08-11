// Pro-rates a salaried allowance for someone's first calendar year, based on
// the fraction of the year remaining from their start date to 31 Dec —
// standard UK practice for a partial first year. Full years (start date in
// an earlier year, or no start date recorded) get the full allowance.
export function proratedAllowance(annualAllowanceDays: number, startDate: string | null, year: number): number {
  if (!startDate) return annualAllowanceDays;

  const start = new Date(startDate + "T00:00:00");
  if (start.getFullYear() !== year) return annualAllowanceDays;

  const yearEnd = new Date(year, 11, 31);
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.round((yearEnd.getTime() - start.getTime()) / msPerDay) + 1;

  return Math.round(((annualAllowanceDays * daysRemaining) / daysInYear) * 10) / 10;
}

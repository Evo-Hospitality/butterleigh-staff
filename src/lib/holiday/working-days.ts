// Counts how many dates in [start, end] (inclusive) fall on one of the
// person's normal working days. Bank holidays are not special-cased here —
// they're normal working days for everyone, per the business rules.
export function countWorkingDays(start: string, end: string, workingDays: number[]): number {
  const workingSet = new Set(workingDays);
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");

  let count = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (workingSet.has(d.getDay())) {
      count += 1;
    }
  }
  return count;
}

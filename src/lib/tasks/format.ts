import type { RecurrenceUnit } from "@/lib/types";

export function recurrenceLabel(unit: RecurrenceUnit | null, value: number | null): string {
  if (!unit || !value) return "One-off";
  if (value === 1 && unit === "days") return "Daily";
  if (value === 1 && unit === "weeks") return "Weekly";
  if (value === 1 && unit === "months") return "Monthly";
  return `Every ${value} ${unit}`;
}

// A task with no due_time is treated as due by end of day, not a fixed
// clock time — a more intuitive default than an arbitrary fixed hour.
export function isOverdue(dueDate: string | null, dueTime: string | null): boolean {
  if (!dueDate) return false;
  const time = dueTime ? dueTime.slice(0, 5) : "23:59";
  return new Date(`${dueDate}T${time}`) < new Date();
}

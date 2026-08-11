import { requireAdmin } from "@/lib/auth";
import type { Profile, MonthlyHoursEntry } from "@/lib/types";
import { HoursForm } from "./hours-form";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function MonthlyHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;

  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const [{ data: staff }, { data: entries }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("employment_type", "hourly")
      .eq("active", true)
      .order("full_name")
      .returns<Profile[]>(),
    supabase
      .from("monthly_hours")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .returns<MonthlyHoursEntry[]>(),
  ]);

  const entryByStaff = new Map(entries?.map((e) => [e.staff_id, e]));

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Monthly hours</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Enter hours worked for each hourly employee this month. Holiday accrues automatically at
        12.07% of hours entered.
      </p>

      <div className="mb-4 flex gap-3 text-sm">
        {[-1, 0, 1].map((offset) => {
          const d = new Date(year, month - 1 + offset, 1);
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          const active = y === year && m === month;
          return (
            <a
              key={offset}
              href={`/admin/hours?year=${y}&month=${m}`}
              className={`rounded-md border px-3 py-1.5 ${
                active ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
              }`}
            >
              {MONTH_NAMES[m - 1]} {y}
            </a>
          );
        })}
      </div>

      <HoursForm
        staff={staff ?? []}
        initialHours={new Map((staff ?? []).map((s) => [s.id, entryByStaff.get(s.id)?.hours_worked]).filter(
          (pair): pair is [string, number] => pair[1] !== undefined,
        ))}
        year={year}
        month={month}
      />
    </div>
  );
}

import { requireAdmin } from "@/lib/auth";
import type { Profile, MonthlyHoursEntry } from "@/lib/types";
import { HoursForm } from "./hours-form";
import { HoursImportPanel, type ImportRow, type UnmatchedRow } from "@/components/hours-import-panel";
import {
  commitTimeEntriesAction,
  deleteHoursImportAction,
  dismissUnmatchedAction,
  linkUnmatchedAction,
  previewTimeEntriesAction,
  recheckUnmatchedAction,
} from "./import-actions";

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

  const [{ data: staff }, { data: entries }, { data: allStaff }, { data: imports }] = await Promise.all([
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
    // The link dropdown needs everyone, not just hourly staff — the name
    // that didn't match might belong to a salaried manager.
    supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
    supabase
      .from("hours_imports")
      .select("*, hours_import_unmatched(*)")
      .eq("year", year)
      .eq("month", month)
      .order("created_at", { ascending: false }),
  ]);

  const entryByStaff = new Map(entries?.map((e) => [e.staff_id, e]));
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const importRows: ImportRow[] = (imports ?? []).map((imp) => ({
    id: imp.id,
    filename: imp.filename,
    period_start: imp.period_start,
    period_end: imp.period_end,
    entry_count: imp.entry_count,
    matched_count: imp.matched_count,
    skipped_salaried: imp.skipped_salaried,
    excluded_count: imp.excluded_count ?? 0,
    total_hours: imp.total_hours,
    imported_by_name: imp.imported_by_name,
    created_at: imp.created_at,
    unmatched: ((imp.hours_import_unmatched ?? []) as UnmatchedRow[]).sort((a, b) =>
      a.display_name.localeCompare(b.display_name),
    ),
  }));

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Monthly hours</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Hours worked by each hourly employee, imported from the time system. Holiday accrues
        automatically at 12.07% of the hours recorded. You can still adjust any figure by hand
        below — a manual edit isn&apos;t removed if the import it came with is.
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

      <HoursImportPanel
        year={year}
        month={month}
        monthLabel={monthLabel}
        imports={importRows}
        staff={allStaff ?? []}
        previewAction={previewTimeEntriesAction}
        commitAction={commitTimeEntriesAction}
        deleteAction={deleteHoursImportAction}
        linkAction={linkUnmatchedAction}
        dismissAction={dismissUnmatchedAction}
        recheckAction={recheckUnmatchedAction}
      />

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

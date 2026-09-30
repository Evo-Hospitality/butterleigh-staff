import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaveBalance, LeaveRequest, LieuRequest, MonthlyHoursEntry, Profile } from "@/lib/types";
import { effectiveAllowance, remainingBalance } from "@/lib/holiday/balance";
import { formatDate, formatDateOnly } from "@/lib/format";

// Holiday statement: every line behind a balance figure, in date order with a
// running total — how it built up and where it went. Shared by the admin
// drill-through from Balances and each person's own view under Holiday, so
// the two can never tell a different story.
//
// The stored balance (leave_balances) is kept up to date incrementally by
// triggers and the approval functions, not recomputed from these lines. So
// the statement rebuilds it from source and, if the two ever disagree
// (a manual edit, a rate change, history from before the app), shows the gap
// as an explicit adjustment rather than silently not adding up.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Line = {
  date: string; // yyyy-mm-dd, for ordering
  label: string;
  detail?: string;
  change: number;
};

type HoursImport = { id: string; filename: string | null; period_start: string | null; period_end: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

function dateRange(start: string, end: string): string {
  return start === end ? formatDateOnly(start) : `${formatDateOnly(start)} – ${formatDateOnly(end)}`;
}

export async function loadHolidayStatement(supabase: SupabaseClient, staffId: string, year: number) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [{ data: person }, { data: balance }, { data: hours }, { data: requests }, { data: lieu }, { data: settings }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", staffId).maybeSingle<Profile>(),
      supabase
        .from("leave_balances")
        .select("*")
        .eq("staff_id", staffId)
        .eq("leave_year", year)
        .maybeSingle<LeaveBalance>(),
      supabase
        .from("monthly_hours")
        .select("*")
        .eq("staff_id", staffId)
        .eq("year", year)
        .order("month")
        .returns<(MonthlyHoursEntry & { import_id: string | null })[]>(),
      supabase
        .from("leave_requests")
        .select("*")
        .eq("staff_id", staffId)
        .gte("start_date", yearStart)
        .lte("start_date", yearEnd)
        .order("start_date")
        .returns<LeaveRequest[]>(),
      supabase
        .from("lieu_requests")
        .select("*")
        .eq("staff_id", staffId)
        .gte("work_date", yearStart)
        .lte("work_date", yearEnd)
        .order("work_date")
        .returns<LieuRequest[]>(),
      supabase.from("settings").select("hourly_accrual_rate").maybeSingle<{ hourly_accrual_rate: number }>(),
    ]);

  if (!person) return null;

  const importIds = [...new Set((hours ?? []).map((h) => h.import_id).filter((id): id is string => !!id))];
  const { data: imports } = importIds.length
    ? await supabase
        .from("hours_imports")
        .select("id, filename, period_start, period_end")
        .in("id", importIds)
        .returns<HoursImport[]>()
    : { data: [] as HoursImport[] };
  const importById = new Map((imports ?? []).map((i) => [i.id, i]));

  const isSalaried = person.employment_type === "salaried";
  const unit = isSalaried ? "days" : "hrs";
  const rate = Number(settings?.hourly_accrual_rate ?? 0.1207);
  const ratePct = `${round2(rate * 100)}%`;

  const opening = Number(balance?.brought_forward ?? 0);
  const approved = (requests ?? []).filter((r) => r.status === "approved");
  const approvedPaid = approved.filter((r) => !r.is_unpaid);
  const approvedUnpaid = approved.filter((r) => r.is_unpaid);
  const pending = (requests ?? []).filter((r) => r.status === "pending" && !r.is_unpaid);
  const approvedLieu = (lieu ?? []).filter((l) => l.status === "approved");

  // --- Earned -----------------------------------------------------------
  const earned: Line[] = [];
  if (isSalaried) {
    const allowance = effectiveAllowance(person, balance, year);
    earned.push({
      date: yearStart,
      label: `Holiday allowance for ${year}`,
      detail:
        person.start_date && new Date(person.start_date).getFullYear() === year
          ? `Pro-rated — started ${formatDateOnly(person.start_date)}`
          : undefined,
      change: allowance,
    });
    for (const l of approvedLieu) {
      earned.push({
        date: l.work_date,
        label: "Day in lieu earned",
        detail: `Worked ${formatDateOnly(l.work_date)}${l.notes ? ` — ${l.notes}` : ""}`,
        change: 1,
      });
    }
    const lieuStored = Number(balance?.lieu_days_earned ?? 0);
    if (round2(lieuStored - approvedLieu.length) !== 0) {
      earned.push({
        date: yearEnd,
        label: "Adjustment to days in lieu",
        detail: "Recorded on the balance but not linked to an approved lieu request",
        change: lieuStored - approvedLieu.length,
      });
    }
  } else {
    let accruedFromLines = 0;
    for (const h of hours ?? []) {
      const accrued = Number(h.hours_worked) * rate;
      accruedFromLines += accrued;
      const imp = h.import_id ? importById.get(h.import_id) : undefined;
      // hours_imports is admin-only, so for staff viewing their own the
      // import row comes back empty — it's still from the time clock.
      const source = h.import_id
        ? `From the time clock${imp?.period_start && imp.period_end ? ` (${dateRange(imp.period_start, imp.period_end)})` : ""}`
        : `Entered by hand ${formatDate(h.entered_at)}`;
      earned.push({
        date: lastDayOfMonth(h.year, h.month),
        label: `${MONTH_NAMES[h.month - 1]} ${h.year}: ${Number(h.hours_worked).toFixed(2)} hrs worked × ${ratePct}`,
        detail: source,
        change: accrued,
      });
    }
    const accruedStored = Number(balance?.accrued_hours ?? 0);
    if (round2(accruedStored - accruedFromLines) !== 0) {
      earned.push({
        date: yearEnd,
        label: "Adjustment to accrued hours",
        detail: "Difference between the stored balance and the monthly hours above",
        change: accruedStored - accruedFromLines,
      });
    }
  }

  // --- Spent ------------------------------------------------------------
  const spent: Line[] = approvedPaid.map((r) => ({
    date: r.start_date,
    label: `Holiday ${dateRange(r.start_date, r.end_date)}`,
    detail: r.decided_at ? `Approved ${formatDate(r.decided_at)}${r.notes ? ` — ${r.notes}` : ""}` : r.notes ?? undefined,
    change: -Number(r.amount),
  }));
  const usedStored = Number((isSalaried ? balance?.used_days : balance?.used_hours) ?? 0);
  const usedFromLines = approvedPaid.reduce((s, r) => s + Number(r.amount), 0);
  if (round2(usedStored - usedFromLines) !== 0) {
    spent.push({
      date: yearEnd,
      label: "Adjustment to holiday taken",
      detail: "Recorded as used on the balance but not linked to an approved request",
      change: -(usedStored - usedFromLines),
    });
  }

  // One date-ordered statement; on the same date, earnings before spending.
  const lines = [...earned.map((l) => ({ ...l, kind: 0 })), ...spent.map((l) => ({ ...l, kind: 1 }))].sort(
    (a, b) => a.date.localeCompare(b.date) || a.kind - b.kind,
  );

  const withRunning: (Line & { running: number })[] = [];
  for (const l of lines) {
    const prev = withRunning.at(-1)?.running ?? opening;
    withRunning.push({ ...l, running: prev + l.change });
  }

  const totalEarned = earned.reduce((s, l) => s + l.change, 0);
  const totalSpent = -spent.reduce((s, l) => s + l.change, 0);
  const closing = remainingBalance(person, balance, year);
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount), 0);

  return {
    year,
    person: { full_name: person.full_name, active: person.active },
    isSalaried,
    unit,
    ratePct,
    opening,
    hasBalance: !!balance,
    lines: withRunning,
    totalEarned,
    totalSpent,
    closing,
    pendingTotal,
    pending: pending.map((r) => ({ id: r.id, start_date: r.start_date, end_date: r.end_date, amount: Number(r.amount) })),
    unpaid: approvedUnpaid.map((r) => ({
      id: r.id,
      start_date: r.start_date,
      end_date: r.end_date,
      amount: Number(r.amount),
    })),
  };
}

export type HolidayStatementData = NonNullable<Awaited<ReturnType<typeof loadHolidayStatement>>>;

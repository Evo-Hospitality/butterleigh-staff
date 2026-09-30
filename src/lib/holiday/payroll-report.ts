import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaveBalance, LeaveRequest, LieuRequest, MonthlyHoursEntry, Profile } from "@/lib/types";
import { remainingBalance } from "./balance";

export type PayrollReportRow = {
  staffId: string;
  fullName: string;
  employmentType: "salaried" | "hourly";
  hoursWorkedThisMonth: number | null; // hourly only
  accruedThisMonth: number | null; // hourly only
  holidayTakenThisMonth: number; // paid holiday only — days (salaried) or hours (hourly)
  unpaidLeaveThisMonth: number; // salaried only, days — deduct pay for these, not holiday balance
  lieuEarnedThisMonth: number; // salaried only, count of days
  remainingBalance: number;
  unit: "days" | "hours";
  // Archived (left) — only listed in a month where they have something to
  // pay or deduct, so a leaver's last holiday can't drop off the report.
  archived: boolean;
};

// One holiday request counted in this pay period — the detail behind the
// "Holiday taken" column, and where an admin moves it to another month.
export type PayrollHolidayItem = {
  id: string;
  staffId: string;
  fullName: string;
  archived: boolean;
  startDate: string;
  endDate: string;
  amount: number;
  unit: "days" | "hours";
  isUnpaid: boolean;
  submittedAt: string;
  decidedAt: string | null;
  // Set when an admin moved it here from the month the normal rule gives.
  movedByName: string | null;
  movedAt: string | null;
  normalPeriod: { year: number; month: number };
};

export type PayrollReport = { rows: PayrollReportRow[]; holidays: PayrollHolidayItem[] };

function inMonth(dateStr: string, year: number, month: number) {
  const d = new Date(dateStr + "T00:00:00");
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

// Payroll cutoff: anything submitted from the 25th onwards has missed that
// month's run and lands in the next one.
const PAYROLL_CUTOFF_DAY = 25;

// created_at is a UTC timestamp, but "the 25th" means the 25th in Devon.
// Reading it with getDate() would use the server's zone — UTC on Vercel,
// BST locally — so a request made late on the 24th UK time would land in a
// different payroll month depending on where the report was generated.
// Formatting in Europe/London makes it the same answer everywhere.
function ukDateParts(iso: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

// Hourly staff are paid for holiday in the month they *asked* for it, not
// the month the dates fall in — someone submitting in August for a shift in
// September expects it in the August packet, and dating it forward
// shouldn't silently push their money a month out.
function payrollMonthForSubmission(createdAt: string): { year: number; month: number } {
  const { year, month, day } = ukDateParts(createdAt);
  if (day >= PAYROLL_CUTOFF_DAY) {
    return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  }
  return { year, month };
}

// The month a request is paid in: an admin's override (0043) if there is
// one, otherwise submission month for hourly (see above) and start-date
// month for salaried, whose pay doesn't change — for them the report is
// about which month the days belong to.
function normalPayPeriod(r: LeaveRequest, isSalaried: boolean): { year: number; month: number } {
  if (isSalaried) {
    const d = new Date(r.start_date + "T00:00:00");
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return payrollMonthForSubmission(r.created_at);
}

function payPeriod(r: LeaveRequest, isSalaried: boolean): { year: number; month: number } {
  if (r.pay_year && r.pay_month) return { year: r.pay_year, month: r.pay_month };
  return normalPayPeriod(r, isSalaried);
}

export async function buildPayrollReport(
  supabase: SupabaseClient,
  year: number,
  month: number,
): Promise<PayrollReport> {
  const [{ data: staff }, { data: balances }, { data: hours }, { data: leave }, { data: lieu }] =
    await Promise.all([
      // Archived staff too — filtered below to those with something this month.
      supabase.from("profiles").select("*").order("full_name").returns<Profile[]>(),
      supabase.from("leave_balances").select("*").eq("leave_year", year).returns<LeaveBalance[]>(),
      supabase.from("monthly_hours").select("*").eq("year", year).eq("month", month).returns<MonthlyHoursEntry[]>(),
      supabase.from("leave_requests").select("*").eq("status", "approved").returns<LeaveRequest[]>(),
      supabase.from("lieu_requests").select("*").eq("status", "approved").returns<LieuRequest[]>(),
    ]);

  const balanceByStaff = new Map((balances ?? []).map((b) => [b.staff_id, b]));
  const hoursByStaff = new Map((hours ?? []).map((h) => [h.staff_id, h]));

  const holidays: PayrollHolidayItem[] = [];

  const rows = (staff ?? []).map((person) => {
    const isSalaried = person.employment_type === "salaried";
    const balance = balanceByStaff.get(person.id);
    const hoursEntry = hoursByStaff.get(person.id);

    const requestsThisMonth = (leave ?? []).filter((r) => {
      if (r.staff_id !== person.id) return false;
      const p = payPeriod(r, isSalaried);
      return p.year === year && p.month === month;
    });

    for (const r of requestsThisMonth) {
      const moved = !!(r.pay_year && r.pay_month);
      holidays.push({
        id: r.id,
        staffId: person.id,
        fullName: person.full_name,
        archived: !person.active,
        startDate: r.start_date,
        endDate: r.end_date,
        amount: Number(r.amount),
        unit: isSalaried ? "days" : "hours",
        isUnpaid: r.is_unpaid,
        submittedAt: r.created_at,
        decidedAt: r.decided_at,
        movedByName: moved ? (r.pay_period_set_by_name ?? "an admin") : null,
        movedAt: moved ? (r.pay_period_set_at ?? null) : null,
        normalPeriod: normalPayPeriod(r, isSalaried),
      });
    }

    const holidayTakenThisMonth = requestsThisMonth
      .filter((r) => !r.is_unpaid)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const unpaidLeaveThisMonth = requestsThisMonth
      .filter((r) => r.is_unpaid)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const lieuEarnedThisMonth = (lieu ?? []).filter(
      (r) => r.staff_id === person.id && inMonth(r.work_date, year, month),
    ).length;

    const remaining = remainingBalance(person, balance, year);

    return {
      staffId: person.id,
      fullName: person.full_name,
      employmentType: person.employment_type,
      hoursWorkedThisMonth: isSalaried ? null : (hoursEntry?.hours_worked ?? 0),
      accruedThisMonth: isSalaried ? null : (hoursEntry?.hours_worked ?? 0) * 0.1207,
      holidayTakenThisMonth,
      unpaidLeaveThisMonth: isSalaried ? unpaidLeaveThisMonth : 0,
      lieuEarnedThisMonth: isSalaried ? lieuEarnedThisMonth : 0,
      remainingBalance: remaining,
      unit: isSalaried ? "days" : "hours",
      archived: !person.active,
    } satisfies PayrollReportRow;
  });

  const hasActivity = (r: PayrollReportRow) =>
    !!r.hoursWorkedThisMonth || r.holidayTakenThisMonth > 0 || r.unpaidLeaveThisMonth > 0 || r.lieuEarnedThisMonth > 0;

  return {
    rows: rows.filter((r) => !r.archived || hasActivity(r)),
    holidays: holidays.sort(
      (a, b) => Number(a.archived) - Number(b.archived) || a.fullName.localeCompare(b.fullName) || a.startDate.localeCompare(b.startDate),
    ),
  };
}

export function payrollReportToCsv(rows: PayrollReportRow[], year: number, month: number): string {
  const header = [
    "Staff",
    "Type",
    `Hours worked (${month}/${year})`,
    "Accrued this month (hrs)",
    "Holiday taken this month",
    "Unpaid leave this month (days)",
    "Lieu days earned this month",
    "Remaining balance",
    "Unit",
  ];

  const lines = [header.join(",")];

  // Empty cell rather than 0, matching the on-screen report — a nil month
  // shouldn't look like a figure that's been checked and come to zero.
  // Spreadsheets still SUM() a blank as nothing, so totals are unaffected.
  const blankIfZero = (n: number | null | undefined, decimals?: number) => {
    if (!n) return "";
    return decimals === undefined ? String(n) : n.toFixed(decimals);
  };

  // Active staff first, then leavers, as on screen.
  const ordered = [...rows.filter((r) => !r.archived), ...rows.filter((r) => r.archived)];
  for (const row of ordered) {
    const name = row.archived ? `${row.fullName} (archived)` : row.fullName;
    lines.push(
      [
        `"${name.replace(/"/g, '""')}"`,
        row.employmentType,
        blankIfZero(row.hoursWorkedThisMonth),
        blankIfZero(row.accruedThisMonth, 2),
        blankIfZero(row.holidayTakenThisMonth),
        blankIfZero(row.unpaidLeaveThisMonth),
        blankIfZero(row.lieuEarnedThisMonth),
        row.remainingBalance.toFixed(2),
        row.unit,
      ].join(","),
    );
  }

  return lines.join("\n");
}

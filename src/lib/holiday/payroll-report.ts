import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaveBalance, LeaveRequest, LieuRequest, MonthlyHoursEntry, Profile } from "@/lib/types";

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
};

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

export async function buildPayrollReport(
  supabase: SupabaseClient,
  year: number,
  month: number,
): Promise<PayrollReportRow[]> {
  const [{ data: staff }, { data: balances }, { data: hours }, { data: leave }, { data: lieu }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
      supabase.from("leave_balances").select("*").eq("leave_year", year).returns<LeaveBalance[]>(),
      supabase.from("monthly_hours").select("*").eq("year", year).eq("month", month).returns<MonthlyHoursEntry[]>(),
      supabase.from("leave_requests").select("*").eq("status", "approved").returns<LeaveRequest[]>(),
      supabase.from("lieu_requests").select("*").eq("status", "approved").returns<LieuRequest[]>(),
    ]);

  const balanceByStaff = new Map((balances ?? []).map((b) => [b.staff_id, b]));
  const hoursByStaff = new Map((hours ?? []).map((h) => [h.staff_id, h]));

  return (staff ?? []).map((person) => {
    const isSalaried = person.employment_type === "salaried";
    const balance = balanceByStaff.get(person.id);
    const hoursEntry = hoursByStaff.get(person.id);

    // Salaried leave still keys off the dates taken — their pay doesn't
    // change, so the report is about which month the days belong to.
    const requestsThisMonth = (leave ?? []).filter((r) => {
      if (r.staff_id !== person.id) return false;
      if (!isSalaried) {
        const p = payrollMonthForSubmission(r.created_at);
        return p.year === year && p.month === month;
      }
      return inMonth(r.start_date, year, month);
    });

    const holidayTakenThisMonth = requestsThisMonth
      .filter((r) => !r.is_unpaid)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const unpaidLeaveThisMonth = requestsThisMonth
      .filter((r) => r.is_unpaid)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const lieuEarnedThisMonth = (lieu ?? []).filter(
      (r) => r.staff_id === person.id && inMonth(r.work_date, year, month),
    ).length;

    const remainingBalance = isSalaried
      ? (balance?.brought_forward ?? 0) +
        (balance?.base_allowance ?? person.annual_allowance_days ?? 0) +
        (balance?.lieu_days_earned ?? 0) -
        (balance?.used_days ?? 0)
      : (balance?.brought_forward ?? 0) + (balance?.accrued_hours ?? 0) - (balance?.used_hours ?? 0);

    return {
      staffId: person.id,
      fullName: person.full_name,
      employmentType: person.employment_type,
      hoursWorkedThisMonth: isSalaried ? null : (hoursEntry?.hours_worked ?? 0),
      accruedThisMonth: isSalaried ? null : (hoursEntry?.hours_worked ?? 0) * 0.1207,
      holidayTakenThisMonth,
      unpaidLeaveThisMonth: isSalaried ? unpaidLeaveThisMonth : 0,
      lieuEarnedThisMonth: isSalaried ? lieuEarnedThisMonth : 0,
      remainingBalance,
      unit: isSalaried ? "days" : "hours",
    };
  });
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

  for (const row of rows) {
    lines.push(
      [
        `"${row.fullName.replace(/"/g, '""')}"`,
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

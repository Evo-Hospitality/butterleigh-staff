import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaveBalance, LeaveRequest, LieuRequest, MonthlyHoursEntry, Profile } from "@/lib/types";

export type PayrollReportRow = {
  staffId: string;
  fullName: string;
  employmentType: "salaried" | "hourly";
  hoursWorkedThisMonth: number | null; // hourly only
  accruedThisMonth: number | null; // hourly only
  holidayTakenThisMonth: number; // days (salaried) or hours (hourly)
  lieuEarnedThisMonth: number; // salaried only, count of days
  remainingBalance: number;
  unit: "days" | "hours";
};

function inMonth(dateStr: string, year: number, month: number) {
  const d = new Date(dateStr + "T00:00:00");
  return d.getFullYear() === year && d.getMonth() + 1 === month;
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

    const holidayTakenThisMonth = (leave ?? [])
      .filter((r) => r.staff_id === person.id && inMonth(r.start_date, year, month))
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
    "Lieu days earned this month",
    "Remaining balance",
    "Unit",
  ];

  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [
        `"${row.fullName.replace(/"/g, '""')}"`,
        row.employmentType,
        row.hoursWorkedThisMonth ?? "",
        row.accruedThisMonth?.toFixed(2) ?? "",
        row.holidayTakenThisMonth,
        row.lieuEarnedThisMonth,
        row.remainingBalance.toFixed(2),
        row.unit,
      ].join(","),
    );
  }

  return lines.join("\n");
}

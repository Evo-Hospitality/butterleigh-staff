import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type CsvAttachment = { filename: string; content: string };

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return escapeCsvValue(value.join(";"));
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvValue(row[c])).join(","));
  }
  return lines.join("\n");
}

// Full raw-table export of everything the Holiday app's numbers are derived
// from — not the payroll summary report. Intended as a standing disaster-
// recovery backup (deleted/tampered rows), so it deliberately pulls
// everything rather than a filtered view, and uses the admin client to
// bypass RLS entirely.
export async function buildHolidayBackupCsvs(supabase: SupabaseClient): Promise<CsvAttachment[]> {
  const [{ data: profiles }, { data: balances }, { data: leaveRequests }, { data: lieuRequests }, { data: hours }, { data: bankHolidays }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, role, employment_type, working_days, contracted_hours_per_week, annual_allowance_days, manager_id, is_manager, active, start_date",
        )
        .order("full_name"),
      supabase.from("leave_balances").select("*").order("leave_year").order("staff_id"),
      supabase.from("leave_requests").select("*").order("start_date"),
      supabase.from("lieu_requests").select("*").order("work_date"),
      supabase.from("monthly_hours").select("*").order("year").order("month"),
      supabase.from("bank_holidays").select("*").order("date"),
    ]);

  return [
    {
      filename: "staff.csv",
      content: toCsv(
        [
          "id",
          "full_name",
          "email",
          "role",
          "employment_type",
          "working_days",
          "contracted_hours_per_week",
          "annual_allowance_days",
          "manager_id",
          "is_manager",
          "active",
          "start_date",
        ],
        profiles ?? [],
      ),
    },
    {
      filename: "leave_balances.csv",
      content: toCsv(
        [
          "id",
          "staff_id",
          "leave_year",
          "brought_forward",
          "base_allowance",
          "lieu_days_earned",
          "accrued_hours",
          "used_days",
          "used_hours",
        ],
        balances ?? [],
      ),
    },
    {
      filename: "leave_requests.csv",
      content: toCsv(
        [
          "id",
          "staff_id",
          "start_date",
          "end_date",
          "amount",
          "is_unpaid",
          "status",
          "approver_id",
          "notes",
          "created_at",
          "decided_at",
        ],
        leaveRequests ?? [],
      ),
    },
    {
      filename: "lieu_requests.csv",
      content: toCsv(
        ["id", "staff_id", "work_date", "status", "approver_id", "notes", "created_at", "decided_at"],
        lieuRequests ?? [],
      ),
    },
    {
      filename: "monthly_hours.csv",
      content: toCsv(
        ["id", "staff_id", "year", "month", "hours_worked", "entered_by", "entered_at"],
        hours ?? [],
      ),
    },
    {
      filename: "bank_holidays.csv",
      content: toCsv(["id", "date", "name"], bankHolidays ?? []),
    },
  ];
}

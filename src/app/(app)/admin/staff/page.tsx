import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { LeaveBalance, Profile } from "@/lib/types";
import { proratedAllowance } from "@/lib/holiday/proration";
import { StaffTables, type StaffRow } from "@/components/staff-tables";

// Index 0 = Sunday, matching profiles.working_days.
const DAY_SHORT = ["Su", "M", "T", "W", "Th", "F", "Sa"];

export default async function StaffListPage() {
  const { supabase } = await requireAdmin();
  const year = new Date().getFullYear();

  const [{ data: staff }, { data: balances }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name").returns<Profile[]>(),
    supabase.from("leave_balances").select("*").eq("leave_year", year).returns<LeaveBalance[]>(),
  ]);

  const balanceByStaff = new Map((balances ?? []).map((b) => [b.staff_id, b]));
  const all = staff ?? [];

  const toRow = (person: Profile): StaffRow => ({
    id: person.id,
    fullName: person.full_name,
    email: person.email,
    employmentType: person.employment_type,
    workingDays: person.working_days.map((d) => DAY_SHORT[d]).join(" "),
    allowance:
      person.employment_type === "salaried"
        ? `${
            balanceByStaff.get(person.id)?.base_allowance ??
            (person.annual_allowance_days
              ? proratedAllowance(person.annual_allowance_days, person.start_date, year)
              : "—")
          } days`
        : "12.07% accrual",
    manager: all.find((m) => m.id === person.manager_id)?.full_name ?? "—",
    role: person.role,
    invited: person.invited_at ? new Date(person.invited_at).toLocaleDateString() : "Not invited",
  });

  // No Status column — which table someone is in says it.
  const active = all.filter((p) => p.active).map(toRow);
  const archived = all.filter((p) => !p.active).map(toRow);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Staff</h1>
        <Link
          href="/admin/staff/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add staff
        </Link>
      </div>

      <StaffTables active={active} archived={archived} />
    </div>
  );
}
